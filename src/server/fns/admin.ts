import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { type AuthUser, requireUser } from "../auth";
import { getDb } from "../db/client";
import { rolePermissions, users } from "../db/schema";
import { getEnv } from "../env";
import {
	DYNAMIC_ROLES,
	getUserFeatures,
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

	// Rely on the users.isAdmin state already validated by requireUser instead
	// of an external Clerk API call on every admin request. The JWT claim is
	// still honored via isClerkAdmin when present.
	const { user, claims } = result;
	if (!isClerkAdmin(claims as unknown as Record<string, unknown>, user)) {
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
