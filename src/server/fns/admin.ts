import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";
import {
	type AuthUser,
	getClerkAdminIds,
	invalidateUserCache,
	isAdminFromClerkApi,
	requireUser,
} from "../auth";
import { getDb } from "../db/client";
import { rolePermissions, users } from "../db/schema";
import { getEnv } from "../env";
import { bumpPermsRev } from "../helpers/watch-item";
import {
	DYNAMIC_ROLES,
	getUserFeatures,
	isAdminByClaims,
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

	// Admin status is decided by the signed JWT claim or the live Clerk API,
	// the same authoritative source `hasFeature` uses. There is no stored
	// `users.isAdmin` flag to consult (the column was removed): a stored copy
	// would go stale the moment someone is demoted in Clerk.
	const isAdmin =
		isAdminByClaims(claims) || (await isAdminFromClerkApi(claims.sub));
	if (!isAdmin) {
		return {
			user: null,
			error: fail("FORBIDDEN", "Forbidden: admin access required"),
		};
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

		// Atomic upsert keyed on the (role, feature) primary key, replaces the
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

		// Global feature flags affect every user, so all permission revisions
		// move together (cheap at this scale, keeps clients off a fixed poll).
		await db.update(users).set({ permsRev: sql`${users.permsRev} + 1` });

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

		await bumpPermsRev(db, target[0].id);
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

		await bumpPermsRev(db, target[0].id);
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

			// Admin status lives in Clerk's public metadata, not the DB (the
			// `users.is_admin` column was removed, a stored copy goes stale).
			// Resolve it with one paginated Clerk user-list call, then index by
			// clerk sub id so the whole page maps in a single pass. On API
			// failure this degrades to "no admins" for display only; it never
			// gates access (that happens in requireAdmin / hasFeature).
			const adminClerkIds = await getClerkAdminIds();

			const results: Array<{
				_id: string;
				tokenIdentifier: string;
				name: string;
				email: string;
				image: string | null;
				roles: string[];
				isBanned: boolean;
				isAdmin: boolean;
			}> = rows.map((u) => ({
				_id: u.id,
				tokenIdentifier: u.tokenIdentifier,
				name: u.name ?? "Anonymous",
				email: u.email ?? "No email",
				image: u.image,
				roles: (u.roles ?? []).filter((role) =>
					DYNAMIC_ROLES.includes(role as (typeof DYNAMIC_ROLES)[number]),
				),
				isBanned: u.isBanned ?? false,
				// tokenIdentifier is `clerk|<sub>` (or a legacy `*|<sub>` variant).
				isAdmin: adminClerkIds.has(u.tokenIdentifier.split("|").pop() ?? ""),
			}));

			return ok(results);
		},
	);
