import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import {
	type AuthUser,
	invalidateUserCache,
	isAdminFromClerkApi,
	requireUser,
} from "../auth";
import { getDb } from "../db/client";
import { rolePermissions, users } from "../db/schema";
import { getEnv } from "../env";
import {
	DYNAMIC_ROLES,
	getUserFeatures,
	isAdminByClaims,
	isClerkAdmin,
	syncRolePermissions,
} from "../rbac";
import {
	listUsersArgsSchema,
	setRolePermissionArgsSchema,
	setUserBannedArgsSchema,
	setUserRolesArgsSchema,
} from "../schema/admin";
import { type ApiResult, fail, ok } from "../schema/common";

async function requireAdmin(): Promise<
	{ user: AuthUser; error: null } | { user: null; error: ApiResult<never> }
> {
	const result = await requireUser();
	if (result.error) return { user: null, error: result.error };

	const { user, claims } = result;

	// Admin status is decided by the signed JWT claim or the live Clerk API
	// (60s-cached) — the same authoritative source `hasFeature` uses. The
	// stored `users.isAdmin` flag is only written at account creation and never
	// refreshed, so trusting it would let a user demoted in Clerk keep admin
	// access indefinitely. The flag is still honored for display purposes via
	// `isClerkAdmin` in listUsers, but never for access decisions.
	const isAdmin =
		isAdminByClaims(claims) || (await isAdminFromClerkApi(claims.sub));
	if (!isAdmin) {
		return {
			user: null,
			error: fail("FORBIDDEN", "Forbidden: admin access required"),
		};
	}

	// Self-heal the stored flag on promotion so listUsers / the admin UI stay
	// consistent with the live source. Only ever writes `true` (the lookup
	// succeeded), never downgrades — a transient Clerk API failure must not
	// erase a stored admin flag.
	if (user.isAdmin !== true) {
		await getDb(getEnv())
			.update(users)
			.set({ isAdmin: true })
			.where(eq(users.id, user.id));
		invalidateUserCache(claims.sub);
	}

	return { user, error: null };
}

export const getUserFeaturesFn = createServerFn({ method: "POST" }).handler(
	async (): Promise<
		ApiResult<{
			roles: string[];
			features: Record<string, boolean>;
			isAdmin: boolean;
			isBanned: boolean;
		}>
	> => {
		const claims = await requireUser();
		if (claims.error) {
			return ok({ roles: [], features: {}, isAdmin: false, isBanned: false });
		}
		return ok(await getUserFeatures(claims.claims, claims.user));
	},
);

export const getRolePermissions = createServerFn({ method: "POST" }).handler(
	async (): Promise<ApiResult<Record<string, Record<string, boolean>>>> => {
		const admin = await requireAdmin();
		if (admin.error) return admin.error;

		const db = getDb(getEnv());
		const perms = await db.select().from(rolePermissions);

		const result: Record<string, Record<string, boolean>> = {};
		for (const role of DYNAMIC_ROLES) {
			result[role] = {};
			const feature =
				role === "video-player" ? "video-player" : "ai-recommendations";
			const perm = perms.find(
				(p) => p.role === "global" && p.feature === feature,
			);
			result[role][feature] = perm ? perm.enabled : true;
		}

		return ok(result);
	},
);

export const setRolePermission = createServerFn({ method: "POST" })
	.validator(setRolePermissionArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const admin = await requireAdmin();
		if (admin.error) return admin.error;

		// feature is already validated to a known RbacFeature by the schema.
		const db = getDb(getEnv());
		await syncRolePermissions(db, true);

		// Atomic upsert keyed on the (role, feature) primary key — replaces the
		// old select-then-insert. Role is always the global feature flag.
		await db
			.insert(rolePermissions)
			.values({
				role: "global",
				feature: data.feature,
				enabled: data.enabled,
			})
			.onConflictDoUpdate({
				target: [rolePermissions.role, rolePermissions.feature],
				set: { enabled: data.enabled },
			});

		return ok({ ok: true });
	});

export const setUserRoles = createServerFn({ method: "POST" })
	.validator(setUserRolesArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const admin = await requireAdmin();
		if (admin.error) return admin.error;

		const db = getDb(getEnv());
		const target = await db
			.select()
			.from(users)
			.where(eq(users.tokenIdentifier, data.tokenIdentifier))
			.limit(1);

		if (target.length === 0) return fail("NOT_FOUND", "User not found");

		await db
			.update(users)
			.set({
				roles: data.roles.length > 0 ? data.roles : [],
			})
			.where(eq(users.id, target[0].id));

		invalidateUserCache(target[0].tokenIdentifier);
		return ok({ ok: true });
	});

export const setUserBanned = createServerFn({ method: "POST" })
	.validator(setUserBannedArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<{ ok: true }>> => {
		const admin = await requireAdmin();
		if (admin.error) return admin.error;

		const db = getDb(getEnv());
		const target = await db
			.select()
			.from(users)
			.where(eq(users.tokenIdentifier, data.tokenIdentifier))
			.limit(1);

		if (target.length === 0) return fail("NOT_FOUND", "User not found");

		if (admin.user.id === target[0].id) {
			return fail("BAD_REQUEST", "Cannot ban yourself");
		}

		await db
			.update(users)
			.set({ isBanned: data.banned })
			.where(eq(users.id, target[0].id));

		invalidateUserCache(target[0].tokenIdentifier);
		return ok({ ok: true });
	});

export const listUsers = createServerFn({ method: "POST" })
	.validator(listUsersArgsSchema)
	.handler(
		async ({
			data,
		}): Promise<
			ApiResult<
				Array<{
					_id: string;
					tokenIdentifier: string;
					name: string;
					email: string;
					image: string | null;
					roles: string[];
					isBanned: boolean;
					isAdmin: boolean;
				}>
			>
		> => {
			const admin = await requireAdmin();
			if (admin.error) return admin.error;

			const db = getDb(getEnv());
			const rows = await db
				.select()
				.from(users)
				.limit(data.limit ?? 200);

			const results: Array<{
				_id: string;
				tokenIdentifier: string;
				name: string;
				email: string;
				image: string | null;
				roles: string[];
				isBanned: boolean;
				isAdmin: boolean;
			}> = [];
			for (const u of rows) {
				results.push({
					_id: u.id,
					tokenIdentifier: u.tokenIdentifier,
					name: u.name ?? "Anonymous",
					email: u.email ?? "No email",
					image: u.image,
					roles: (u.roles ?? []).filter((role) =>
						DYNAMIC_ROLES.includes(role as (typeof DYNAMIC_ROLES)[number]),
					),
					isBanned: u.isBanned ?? false,
					// Derive isAdmin from the stored row — no per-user Clerk API call.
					isAdmin: isClerkAdmin(null, { isAdmin: u.isAdmin ?? false }),
				});
			}

			return ok(results);
		},
	);
