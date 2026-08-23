import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { invalidateUserCache } from "../auth";
import { users } from "../db/schema";
import { ok } from "../schema/common";
import { authedFn } from "./rpc";

const storeUserArgsSchema = v.object({
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
});

/**
 * Port of `users.store`, upserts the user from the verified Clerk session.
 * Admin status is deliberately not part of this payload: it lives in Clerk's
 * public metadata (JWT claim / live API), and a stored copy would go stale.
 */
export const storeUser = createServerFn({ method: "POST" })
  .validator(storeUserArgsSchema)
  .handler(({ data }) =>
    authedFn({ mode: "require" }, data, async ({ claims, db, user }) => {
      // Only include defined fields so an empty request performs no update.
      const update: Partial<typeof users.$inferSelect> = {};
      if (data.name !== undefined) update.name = data.name;
      if (data.image !== undefined) update.image = data.image;
      if (data.email !== undefined) update.email = data.email;

      if (Object.keys(update).length > 0) {
        await db.update(users).set(update).where(eq(users.id, user.id));
        invalidateUserCache(claims.sub);
      }
      return ok(user.id);
    }),
  );
