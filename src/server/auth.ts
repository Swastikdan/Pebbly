import { createClerkClient, verifyToken } from "@clerk/backend";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { eq, inArray, or, sql } from "drizzle-orm";
import { getDb, runBatch } from "./db/client";
import { users, watchItems } from "./db/schema";
import { getEnv, getEnvVar } from "./env";

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
	name?: string | null;
	nickname?: string | null;
	email?: string | null;
	picture?: string | null;
	pictureUrl?: string | null;
	[key: string]: unknown;
}

/**
 * Extract the Clerk session token from the incoming request. Prefers the
 * `Authorization: Bearer` header (server-fn calls / API clients), then the
 * standard Clerk `__session` cookie (browser same-origin calls).
 */
export function getSessionToken(): string | undefined {
	const authHeader = getRequestHeader("authorization");
	if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
		const bearer = authHeader.slice(7).trim();
		if (bearer.length > 0) return bearer;
	}
	const cookieToken = getCookie("__session") || getCookie("__clerk_db_jwt");
	if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
		return cookieToken.trim();
	}
	return undefined;
}

/**
 * Verify the Clerk session token and return the JWT claims, or `null` when
 * there is no session / the token is invalid or expired.
 */
export async function getSessionClaims(): Promise<ClerkSessionClaims | null> {
	const token = getSessionToken();
	if (!token) return null;

	// A valid JWT consists of header.payload.signature (3 dot-separated segments)
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
	} catch {
		// Expired or transitioning token — treated safely as unauthenticated/guest
		return null;
	}
}

/** Derive the canonical tokenIdentifier (Convex Clerk format: `clerk|<sub>`). */
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

/**
 * LIKE predicate matching any tokenIdentifier that ends in `|{subject}`,
 * treating `%` / `_` inside the subject as literals.
 */
function tokenIdentifierLike(subject: string) {
	return sql`${users.tokenIdentifier} like ${`%|${escapeLikePattern(subject)}`} escape '\\'`;
}

/** Get admin flag from JWT public metadata (snake_case or camelCase claim). */
export function getAdminFromClaims(
	claims: ClerkSessionClaims | null,
): boolean | null {
	if (!claims) return null;
	const meta =
		(claims.public_meta as Record<string, unknown> | undefined) ??
		(claims.publicMetadata as Record<string, unknown> | undefined);
	if (meta && typeof meta === "object" && "isAdmin" in meta) {
		return meta.isAdmin === true;
	}
	return null;
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
 * Resolve `isAdmin` from Clerk's public metadata via the backend API.
 *
 * The Clerk JWT does not carry public metadata unless a custom JWT template /
 * session claim adds it, while the client SDK (`useUser`) reads it straight
 * from the user resource. This keeps the server in agreement with the client:
 * Clerk's public metadata is the source of truth for admin status.
 *
 * Deliberately uncached: Workers isolates don't share memory, so an in-memory
 * Map would be both fragmented across isolates and potentially stale. Callers
 * should prefer the signed JWT claim (`isAdminByClaims` / `getAdminFromClaims`)
 * and only fall back here when the claim is absent.
 */
export async function isAdminFromClerkApi(sub: string): Promise<boolean> {
	const client = getClerkApiClient();
	if (!client) return false;
	try {
		// Bound the external call so a stalled Clerk API cannot hang the
		// request. A timeout degrades to `false`, never `true`. The Clerk
		// client does not accept a per-call signal, so use a deadline race.
		const clerkUser = await withTimeout(
			client.users.getUser(sub),
			ADMIN_API_TIMEOUT_MS,
			"Clerk admin lookup timed out",
		);
		return clerkUser.publicMetadata?.isAdmin === true;
	} catch (error) {
		console.error("Failed to fetch Clerk user for admin check:", error);
		return false;
	}
}

/**
 * Fetch the Clerk user ids whose public metadata marks them admin, using one
 * paginated API call per page (max page size). Used to render the admin user
 * table without a per-row lookup. Returns an empty set on any failure — this
 * is display-only data and must never be used for access decisions.
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
			// Stop when we've seen every user or the API returned a short page
			// (defensive — a hard cap above guards against an endless loop).
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

	// Fast path: direct unique index seek on the canonical tokenIdentifier
	const exactMatches = await db
		.select()
		.from(users)
		.where(eq(users.tokenIdentifier, tokenIdentifier))
		.limit(1);

	if (exactMatches.length > 0) {
		return exactMatches;
	}

	// Fallback for legacy user formats (bare sub or custom prefixes)
	return db
		.select()
		.from(users)
		.where(or(eq(users.tokenIdentifier, subject), tokenIdentifierLike(subject)))
		.limit(10);
}

/**
 * Pick the canonical user from a set of duplicate matches: prefer the doc that
 * already has watch items, then the exact `clerk|<sub>` tokenIdentifier.
 */
async function pickBestUserMatch(
	matches: AuthUser[],
	tokenIdentifier: string,
): Promise<AuthUser | null> {
	if (matches.length === 0) return null;
	if (matches.length === 1) return matches[0];

	const db = getDb(getEnv());
	for (const candidate of matches) {
		const hasItems = await db
			.select({ id: watchItems.id })
			.from(watchItems)
			.where(eq(watchItems.userId, candidate.id))
			.limit(1);
		if (hasItems.length > 0) return candidate;
	}

	return (
		matches.find((u) => u.tokenIdentifier === tokenIdentifier) ?? matches[0]
	);
}

/**
 * Port of `convex/helpers/watch_item.ts` `getCurrentUser` — multi-format
 * tokenIdentifier matching so users created under any prior format resolve.
 * Uses a short-lived in-memory cache to eliminate duplicate database hits.
 */
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
 * `requireCurrentUser` port: resolves the user, creating one on first sign-in
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

	// Resolve once and reuse the matches — no second identical query below.
	const userMatches = await findUserMatchesByClaims(claims);
	let user = await pickBestUserMatch(userMatches, tokenIdentifier);

	if (!user) {
		const id = crypto.randomUUID();
		// onConflictDoNothing makes concurrent first sign-ins race-safe: when
		// two requests for a brand-new user insert at once, one wins and the
		// other no-ops instead of throwing on the unique token_identifier
		// index (which would 500 a parallel request on first load).
		// Admin status is intentionally NOT persisted here — it lives in Clerk's
		// public metadata (JWT claim / live API) and a stored copy would go stale.
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
		// Re-read by the canonical tokenIdentifier — the winner of a concurrent
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
	}

	// Auto-consolidate orphaned watch items from duplicate user documents (port
	// of the Convex `requireCurrentUser` consolidation step). Only runs when
	// duplicate user rows were matched, and rewrites are batched so the path
	// stays O(2-3 queries) instead of one query per duplicate item.
	if (userMatches.length > 1) {
		const dupUserIds = userMatches
			.filter((dup) => dup.id !== user.id)
			.map((dup) => dup.id);

		if (dupUserIds.length > 0) {
			const dupItems = await db
				.select()
				.from(watchItems)
				.where(inArray(watchItems.userId, dupUserIds))
				.limit(500);

			const mainItems = await db
				.select({ tmdbId: watchItems.tmdbId, mediaType: watchItems.mediaType })
				.from(watchItems)
				.where(eq(watchItems.userId, user.id))
				.limit(500);
			const mainKeys = new Set(
				mainItems.map((i) => `${i.tmdbId}:${i.mediaType}`),
			);

			const orphanIds = dupItems
				.filter((item) => !mainKeys.has(`${item.tmdbId}:${item.mediaType}`))
				.map((item) => item.id);

			if (orphanIds.length > 0) {
				await runBatch(
					db,
					orphanIds.map((itemId) =>
						db
							.update(watchItems)
							.set({ userId: user.id })
							.where(eq(watchItems.id, itemId)),
					),
				);
			}
		}
	}

	return { user, claims, error: null };
}

/** Shortcut: resolve the current user without creating one. */
export async function getCurrentUser() {
	const claims = await getSessionClaims();
	if (!claims) return null;
	return findUserByClaims(claims);
}

export type { Db } from "./db/client";
