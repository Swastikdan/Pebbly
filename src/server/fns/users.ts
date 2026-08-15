import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { getAdminFromClaims, getCurrentUser, requireUser } from "../auth";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { getEnv } from "../env";
import { syncRolePermissions } from "../rbac";
import { type ApiResult, ok } from "../schema/common";

const storeUserArgsSchema = v.object({
	email: v.optional(v.string()),
	name: v.optional(v.string()),
	image: v.optional(v.string()),
	isAdmin: v.optional(v.boolean()),
});

/**
 * Port of `users.store` — upserts the user from the verified Clerk session.
 * Admin status comes from the JWT `public_meta.isAdmin` claim first; the
 * client-supplied value is only used to downgrade a stale JWT (never to elevate).
 */
export const storeUser = createServerFn({ method: "POST" })
	.validator(storeUserArgsSchema)
	.handler(async ({ data }): Promise<ApiResult<string>> => {
		const result = await requireUser();
		if (result.error) return result.error;

		const { user, claims } = result;
		const db = getDb(getEnv());
		await syncRolePermissions(db);

		const adminFromJwt = getAdminFromClaims(claims);

		const update: Partial<typeof users.$inferSelect> = {
			name: data.name,
			image: data.image,
			email: data.email,
		};
		if (adminFromJwt !== null) {
			update.isAdmin = adminFromJwt;
		} else if (data.isAdmin === false) {
			update.isAdmin = false;
		}

		await db.update(users).set(update).where(eq(users.id, user.id));
		return ok(user.id);
	});

export const getStatus = createServerFn({ method: "POST" }).handler(
	async (): Promise<ApiResult<typeof users.$inferSelect | null>> => {
		const user = await getCurrentUser();
		return ok(user);
	},
);
