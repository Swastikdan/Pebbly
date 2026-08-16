import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import {
	getAdminFromClaims,
	getCurrentUser,
	invalidateUserCache,
	requireUser,
} from "../auth";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { getEnv } from "../env";
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

		const adminFromJwt = getAdminFromClaims(claims);

		// Only include defined fields so an empty request performs no update.
		const update: Partial<typeof users.$inferSelect> = {};
		if (data.name !== undefined) update.name = data.name;
		if (data.image !== undefined) update.image = data.image;
		if (data.email !== undefined) update.email = data.email;
		if (adminFromJwt !== null) {
			update.isAdmin = adminFromJwt;
		} else if (data.isAdmin === false) {
			update.isAdmin = false;
		}

		if (Object.keys(update).length > 0) {
			await db.update(users).set(update).where(eq(users.id, user.id));
			invalidateUserCache(claims.sub);
		}
		return ok(user.id);
	});

export const getStatus = createServerFn({ method: "POST" }).handler(
	async (): Promise<ApiResult<typeof users.$inferSelect | null>> => {
		const user = await getCurrentUser();
		return ok(user);
	},
);
