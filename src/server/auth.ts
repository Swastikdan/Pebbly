import { createClerkClient, verifyToken } from "@clerk/backend";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { eq, or, sql } from "drizzle-orm";

import { getDb } from "./db/client";
import { users } from "./db/schema";
import { getEnv, getEnvVar } from "./env";
import { pickCanonicalMatch } from "./helpers/user-merge";

/** Canonical `users` row shape (used before `findUserByClaims` is defined). */
export type AuthUser = typeof users.$inferSelect;

/**
 * Clerk JWT payload shape (subset we rely on). `sub` is the Clerk user id.
 */
export interface ClerkSessionClaims {
  sub: string;
  sid?: string;
  iss?: string;
  public_meta?: Record<string, unknown> | string;
  publicMetadata?: Record<string, unknown> | string;
  /** Legacy Convex-era session-token templates embed public metadata here. */
  metadata?: Record<string, unknown> | string;
  name?: string | null;
  nickname?: string | null;
  email?: string | null;
  picture?: string | null;
  pictureUrl?: string | null;
  [key: string]: unknown;
}

export function getSessionToken(): string | undefined {
  const authHeader = getRequestHeader("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.length > 0) return bearer;
  }
  const cookieToken = getCookie("__session") || getCookie("__clerk_db_jwt");
  if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }
  return undefined;
}

export async function getSessionClaims(): Promise<ClerkSessionClaims | null> {
  const token = getSessionToken();
  if (!token) return null;

  if (token.split(".").length !== 3) return null;

  const secretKey = getEnvVar("CLERK_SECRET_KEY");
  if (!secretKey) return null;

  const issuer = getEnvVar("CLERK_ISSUER_URL");

  try {
    const claims = await verifyToken(token, {
      secretKey,
      ...(issuer ? { issuer } : {}),
      // Tolerate modest clock drift / refresh races without accepting
      // tokens that are five minutes stale.
      clockSkewInMs: 10_000,
    });
    return claims as ClerkSessionClaims;
  } catch (error) {
    // Invalid/expired tokens are expected traffic (refresh races, revoked
    // sessions); log the reason at warn level for production visibility,
    // never the token itself.
    console.warn(
      "[auth] session token verification failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function toTokenIdentifier(sub: string): string {
  return sub.startsWith("clerk|") ? sub : `clerk|${sub}`;
}

/**
 * Escape `%`, `_`, and `\` so a tokenIdentifier fallback LIKE pattern cannot
 * interpret characters from the subject as wildcards. Used with an explicit
 * `ESCAPE '\'` clause (see `tokenIdentifierLike`).
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function tokenIdentifierLike(subject: string) {
  return sql`${users.tokenIdentifier} like ${`%|${escapeLikePattern(subject)}`} escape '\\'`;
}

/** Reject `promise` after `ms` if it has not settled. */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let clerkApiClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkApiClient() {
  const secretKey = getEnvVar("CLERK_SECRET_KEY");
  if (!secretKey) return null;
  if (!clerkApiClient) {
    clerkApiClient = createClerkClient({ secretKey });
  }
  return clerkApiClient;
}

const ADMIN_API_TIMEOUT_MS = 5_000;

/**
 * Fetch the Clerk user ids whose public metadata marks them admin, using one
 * paginated API call per page (max page size). Used to render the admin user
 * table without a per-row lookup. Returns an empty set on any failure. This
 * is display-only data and must never be used for access decisions. Those
 * come exclusively from the signed JWT claim (isAdminByClaims), which the
 * Clerk session-claims template populates from `publicMetadata.isAdmin`.
 */
export async function getClerkAdminIds(): Promise<Set<string>> {
  const client = getClerkApiClient();
  if (!client) return new Set();
  const adminIds = new Set<string>();
  try {
    const PAGE_SIZE = 500;
    for (let offset = 0; offset < 10_000; offset += PAGE_SIZE) {
      const result = await withTimeout(
        client.users.getUserList({ limit: PAGE_SIZE, offset }),
        ADMIN_API_TIMEOUT_MS,
        "Clerk user list lookup timed out",
      );
      const pageUsers = result.data ?? [];
      for (const clerkUser of pageUsers) {
        if (clerkUser.publicMetadata?.isAdmin === true && clerkUser.id) {
          adminIds.add(clerkUser.id);
        }
      }
      const totalCount = result.totalCount ?? 0;
      if (pageUsers.length < PAGE_SIZE || offset + PAGE_SIZE >= totalCount) {
        break;
      }
    }
  } catch (error) {
    console.error("Failed to fetch Clerk user list for admin display:", error);
  }
  return adminIds;
}

const USER_CACHE_TTL_MS = 15_000;
const USER_CACHE_MAX_SIZE = 500;
const userCache = new Map<
  string,
  { user: AuthUser | null; expiresAt: number }
>();

function pruneUserCache() {
  const now = Date.now();
  for (const [key, entry] of userCache) {
    if (entry.expiresAt <= now) userCache.delete(key);
  }
  while (userCache.size > USER_CACHE_MAX_SIZE) {
    const oldest = userCache.keys().next().value;
    if (oldest === undefined) break;
    userCache.delete(oldest);
  }
}

export function invalidateUserCache(sub?: string) {
  if (sub) {
    userCache.delete(sub);
    userCache.delete(toTokenIdentifier(sub));
  } else {
    userCache.clear();
  }
}

/**
 * Multi-format tokenIdentifier matching so users created under any prior
 * format resolve (`clerk|<sub>`, bare `<sub>`, or any `*|<sub>` legacy prefix).
 * Fast-paths the canonical format with a direct unique index seek before
 * falling back to the legacy LIKE pattern.
 */
async function findUserMatchesByClaims(
  claims: ClerkSessionClaims,
): Promise<AuthUser[]> {
  const db = getDb(getEnv());
  const subject = claims.sub;
  if (!subject) return [];
  const tokenIdentifier = toTokenIdentifier(subject);

  const exactMatches = await db
    .select()
    .from(users)
    .where(eq(users.tokenIdentifier, tokenIdentifier))
    .limit(1);

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // Legacy LIKE fallback: matches accounts whose token_identifier predates the
  // canonical `clerk:<sub>` format (Convex-era migration). Runs only when the
  // exact-index seek misses, which for genuinely new users means a full table
  // scan on first request. The background user-maintenance task owns legacy
  // duplicate convergence, so once its migration window has closed, set
  // DISABLE_LEGACY_TOKEN_LOOKUP=true in production to skip the scan entirely
  // (see ADR-004 / architecture-hardening-plan item 4).
  if (getEnvVar("DISABLE_LEGACY_TOKEN_LOOKUP") === "true") {
    return [];
  }

  return db
    .select()
    .from(users)
    .where(or(eq(users.tokenIdentifier, subject), tokenIdentifierLike(subject)))
    .limit(10);
}

async function pickBestUserMatch(
  matches: AuthUser[],
  tokenIdentifier: string,
): Promise<AuthUser | null> {
  // Deterministic, probe-free choice (legacy duplicate reconciliation moved
  // to the offline user-maintenance task; see helpers/user-merge.ts).
  return pickCanonicalMatch(matches, tokenIdentifier);
}

export async function findUserByClaims(
  claims: ClerkSessionClaims,
): Promise<AuthUser | null> {
  const sub = claims.sub;
  if (!sub) return null;

  const now = Date.now();
  const cached = userCache.get(sub);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  const matches = await findUserMatchesByClaims(claims);
  const user = await pickBestUserMatch(matches, toTokenIdentifier(sub));

  userCache.set(sub, {
    user,
    expiresAt: now + USER_CACHE_TTL_MS,
  });
  pruneUserCache();

  return user;
}

export type RequireUserResult =
  | { user: AuthUser; claims: ClerkSessionClaims; error: null }
  | {
      user: null;
      claims: null;
      error: { ok: false; code: "UNAUTHORIZED"; message: string };
    };

/**
 * Resolves the user, creating one on first sign-in
 * (identity from the verified Clerk claims). Returns a typed error result when
 * unauthenticated.
 */
export async function requireUser(): Promise<RequireUserResult> {
  const claims = await getSessionClaims();
  if (!claims) {
    return {
      user: null,
      claims: null,
      error: { ok: false, code: "UNAUTHORIZED", message: "Unauthorized" },
    };
  }

  const db = getDb(getEnv());
  const tokenIdentifier = toTokenIdentifier(claims.sub);

  let user = await findUserByClaims(claims);

  if (!user) {
    const id = crypto.randomUUID();
    await db
      .insert(users)
      .values({
        id,
        tokenIdentifier,
        name: claims.name ?? claims.nickname ?? "Anonymous",
        email: claims.email ?? undefined,
        image: claims.picture ?? claims.pictureUrl ?? undefined,
      })
      .onConflictDoNothing();
    // Re-read by the canonical tokenIdentifier, the winner of a concurrent
    // insert created the same identifier, so this always finds the
    // authoritative row (a lookup by our discarded `id` would miss it).
    user = (
      await db
        .select()
        .from(users)
        .where(eq(users.tokenIdentifier, tokenIdentifier))
        .limit(1)
    )[0];
    if (!user) {
      throw new Error("Failed to create user record after first sign-in");
    }
    // The pre-create lookup cached a negative entry for this subject; drop it
    // so subsequent requests resolve the fresh row without re-inserting.
    invalidateUserCache(claims.sub);
  }

  // Note: legacy duplicate accounts are no longer reconciled here. That work
  // moved to the offline `user-maintenance` task (helpers/user-merge.ts).

  return { user, claims, error: null };
}

/** Shortcut: resolve the current user without creating one. */
export async function getCurrentUser() {
  const claims = await getSessionClaims();
  if (!claims) return null;
  return findUserByClaims(claims);
}

export type { Db } from "./db/client";
