import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { invalidateUserCache } from "../auth";
import { users } from "../db/schema";
import { ok } from "../schema/common";
import { authedFn, WRITE_RATE_LIMIT } from "./rpc";

const storeUserArgsSchema = v.object({
  email: v.optional(v.pipe(v.string(), v.maxLength(320))),
  name: v.optional(v.pipe(v.string(), v.maxLength(100))),
  image: v.optional(v.pipe(v.string(), v.maxLength(2048))),
});

export const storeUser = createServerFn({ method: "POST" })
  .validator(storeUserArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ claims, db, user }) => {
        const update: Partial<typeof users.$inferSelect> = {};
        if (data.name !== undefined) update.name = data.name;
        if (data.image !== undefined) update.image = data.image;
        if (data.email !== undefined) update.email = data.email;

        if (Object.keys(update).length > 0) {
          await db.update(users).set(update).where(eq(users.id, user.id));
          invalidateUserCache(claims.sub);
        }
        return ok(user.id);
      },
    ),
  );
