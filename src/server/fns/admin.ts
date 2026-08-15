import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
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

		if (
			data.feature !== "video-player" &&
			data.feature !== "ai-recommendations"
		) {
			return fail("BAD_REQUEST", "Invalid feature");
		}

		const db = getDb(getEnv());
		await syncRolePermissions(db, true);

		const existing = await db
			.select()
			.from(rolePermissions)
			.where(
				and(
					eq(rolePermissions.role, "global"),
					eq(rolePermissions.feature, data.feature),
				),
			)
			.limit(1);

		if (existing.length > 0) {
			await db
				.update(rolePermissions)
				.set({ enabled: data.enabled })
				.where(
					and(
						eq(rolePermissions.role, "global"),
						eq(rolePermissions.feature, data.feature),
					),
				);
		} else {
			await db.insert(rolePermissions).values({
				role: "global",
				feature: data.feature,
				enabled: data.enabled,
			});
		}

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

			return ok(
				rows.map((u) => ({
					_id: u.id,
					tokenIdentifier: u.tokenIdentifier,
					name: u.name ?? "Anonymous",
					email: u.email ?? "No email",
					image: u.image,
					roles: (u.roles ?? []).filter((role) =>
						DYNAMIC_ROLES.includes(role as (typeof DYNAMIC_ROLES)[number]),
					),
					isBanned: u.isBanned ?? false,
					isAdmin: isClerkAdmin(null, { isAdmin: u.isAdmin ?? false }),
				})),
			);
		},
	);
