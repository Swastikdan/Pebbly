import { createClerkClient, verifyToken } from "@clerk/backend";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { users, watchItems } from "./db/schema";
import { getEnv, getEnvVar } from "./env";

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
		return authHeader.slice(7);
	}
	return getCookie("__session") || getCookie("__clerk_db_jwt");
}

/**
 * Verify the Clerk session token and return the JWT claims, or `null` when
 * there is no session / the token is invalid.
 */
export async function getSessionClaims(): Promise<ClerkSessionClaims | null> {
	const token = getSessionToken();
	if (!token) return null;

	const secretKey = getEnvVar("CLERK_SECRET_KEY");
	if (!secretKey) return null;

	try {
		const claims = await verifyToken(token, {
			secretKey,
			// Tolerate clock drift / refresh races (Clerk dev JWTs are short-lived).
			clockSkewInMs: 300_000,
		});
		return claims as ClerkSessionClaims;
	} catch (error) {
		console.error("Clerk token verification failed:", error);
		return null;
	}
}

/** Derive the canonical tokenIdentifier (Convex Clerk format: `clerk|<sub>`). */
export function toTokenIdentifier(sub: string): string {
	return sub.startsWith("clerk|") ? sub : `clerk|${sub}`;
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

let clerkApiClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkApiClient() {
	const secretKey = getEnvVar("CLERK_SECRET_KEY");
	if (!secretKey) return null;
	if (!clerkApiClient) {
		clerkApiClient = createClerkClient({ secretKey });
	}
	return clerkApiClient;
}

const ADMIN_API_CACHE_TTL_MS = 60_000;
const adminApiCache = new Map<string, { value: boolean; expiresAt: number }>();

/**
 * Resolve `isAdmin` from Clerk's public metadata via the backend API.
 *
 * The Clerk JWT does not carry public metadata unless a custom JWT template /
 * session claim adds it, while the client SDK (`useUser`) reads it straight
 * from the user resource. This keeps the server in agreement with the client:
 * Clerk's public metadata is the source of truth for admin status. Results are
 * cached briefly (60s) to avoid an API call on every request.
 */
export async function isAdminFromClerkApi(sub: string): Promise<boolean> {
	const cached = adminApiCache.get(sub);
	if (cached && cached.expiresAt > Date.now()) return cached.value;

	const client = getClerkApiClient();
	let isAdmin = false;
	if (client) {
		try {
			const clerkUser = await client.users.getUser(sub);
			isAdmin = clerkUser.publicMetadata?.isAdmin === true;
		} catch (error) {
			console.error("Failed to fetch Clerk user for admin check:", error);
		}
	}

	adminApiCache.set(sub, {
		value: isAdmin,
		expiresAt: Date.now() + ADMIN_API_CACHE_TTL_MS,
	});
	return isAdmin;
}

/**
 * Port of `convex/helpers/watch_item.ts` `getCurrentUser` — multi-format
 * tokenIdentifier matching so users created under any prior format resolve.
 */
export async function findUserByClaims(claims: ClerkSessionClaims) {
	const db = getDb(getEnv());
	const subject = claims.sub;
	const tokenIdentifier = toTokenIdentifier(subject);
	const candidates = new Set<string>([
		tokenIdentifier,
		subject,
		`clerk|${subject}`,
	]);

	const allUsers = await db.select().from(users).limit(500);

	const matches = allUsers.filter(
		(u) =>
			candidates.has(u.tokenIdentifier) ||
			(subject && u.tokenIdentifier.endsWith(`|${subject}`)) ||
			(subject && u.tokenIdentifier.endsWith(subject)),
	);

	if (matches.length === 0) return null;
	if (matches.length === 1) return matches[0];

	// Prefer the doc that already has watch items, then the exact tokenIdentifier.
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

export type AuthUser = NonNullable<
	Awaited<ReturnType<typeof findUserByClaims>>
>;

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
	let user = await findUserByClaims(claims);
	if (!user) {
		const isAdmin =
			getAdminFromClaims(claims) ?? (await isAdminFromClerkApi(claims.sub));
		const id = crypto.randomUUID();
		await db.insert(users).values({
			id,
			tokenIdentifier: toTokenIdentifier(claims.sub),
			name: claims.name ?? claims.nickname ?? "Anonymous",
			email: claims.email ?? undefined,
			image: claims.picture ?? claims.pictureUrl ?? undefined,
			isAdmin: isAdmin ?? false,
		});
		user = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
	}

	// Auto-consolidate orphaned watch items from duplicate user documents (port
	// of the Convex `requireCurrentUser` consolidation step).
	const subject = claims.sub;
	const tokenIdentifier = toTokenIdentifier(subject);
	const candidates = new Set<string>([
		tokenIdentifier,
		subject,
		`clerk|${subject}`,
	]);
	const allUsers = await db.select().from(users).limit(500);
	const userMatches = allUsers.filter(
		(u) =>
			candidates.has(u.tokenIdentifier) ||
			(subject && u.tokenIdentifier.endsWith(`|${subject}`)) ||
			(subject && u.tokenIdentifier.endsWith(subject)),
	);

	if (userMatches.length > 1) {
		for (const dup of userMatches) {
			if (dup.id === user.id) continue;
			const dupItems = await db
				.select()
				.from(watchItems)
				.where(eq(watchItems.userId, dup.id))
				.limit(500);
			for (const item of dupItems) {
				const existingInMain = await db
					.select({ id: watchItems.id })
					.from(watchItems)
					.where(
						and(
							eq(watchItems.userId, user.id),
							eq(watchItems.tmdbId, item.tmdbId),
							eq(watchItems.mediaType, item.mediaType),
						),
					)
					.limit(1);
				if (existingInMain.length === 0) {
					await db
						.update(watchItems)
						.set({ userId: user.id })
						.where(eq(watchItems.id, item.id));
				}
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
