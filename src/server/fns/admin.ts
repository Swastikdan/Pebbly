import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import type { ApiResult } from "../schema/common";
import { getClerkAdminIds, invalidateUserCache } from "../auth";
import { rolePermissions, users } from "../db/schema";
import { bumpPermsRev } from "../helpers/watch-item";
import {
  DYNAMIC_ROLES,
  getGlobalFeatureFlags,
  getUserFeatures,
  ROLE_FEATURES,
  syncRolePermissions,
} from "../rbac";
import {
  listUsersArgsSchema,
  setRolePermissionArgsSchema,
  setUserBannedArgsSchema,
  setUserRolesArgsSchema,
} from "../schema/admin";
import { fail, ok } from "../schema/common";
import { authedFn } from "./rpc";

async function findUserByTokenIdentifier(db: Db, tokenIdentifier: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.tokenIdentifier, tokenIdentifier))
    .limit(1);
  return rows[0] ?? null;
}

export const getUserFeaturesFn = createServerFn({ method: "POST" }).handler(
  () =>
    authedFn(
      {
        mode: "require",
        guest: () =>
          ok({ roles: [], features: {}, isAdmin: false, isBanned: false }),
      },
      undefined,
      async ({
        claims,
        user,
      }): Promise<
        ApiResult<{
          roles: string[];
          features: Record<string, boolean>;
          isAdmin: boolean;
          isBanned: boolean;
        }>
      > => ok(await getUserFeatures(claims, user)),
    ),
);

export const getRolePermissions = createServerFn({ method: "POST" }).handler(
  () =>
    authedFn({ admin: true }, undefined, async ({ db }) => {
      const flags = await getGlobalFeatureFlags(db);

      const result: Record<string, Record<string, boolean>> = {};
      for (const role of DYNAMIC_ROLES) {
        const feature = ROLE_FEATURES[role];
        result[role] = { [feature]: flags[feature] };
      }

      return ok(result);
    }),
);

export const setRolePermission = createServerFn({ method: "POST" })
  .validator(setRolePermissionArgsSchema)
  .handler(({ data }) =>
    authedFn({ admin: true }, data, async ({ db }) => {
      // feature is already validated to a known RbacFeature by the schema.
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
    }),
  );

export const setUserRoles = createServerFn({ method: "POST" })
  .validator(setUserRolesArgsSchema)
  .handler(({ data }) =>
    authedFn({ admin: true }, data, async ({ db }) => {
      const target = await findUserByTokenIdentifier(db, data.tokenIdentifier);

      if (!target) return fail("NOT_FOUND", "User not found");

      await db
        .update(users)
        .set({
          roles: data.roles.length > 0 ? data.roles : [],
        })
        .where(eq(users.id, target.id));

      await bumpPermsRev(db, target.id);
      invalidateUserCache(target.tokenIdentifier);
      return ok({ ok: true });
    }),
  );

export const setUserBanned = createServerFn({ method: "POST" })
  .validator(setUserBannedArgsSchema)
  .handler(({ data }) =>
    authedFn({ admin: true }, data, async ({ db, user }) => {
      const target = await findUserByTokenIdentifier(db, data.tokenIdentifier);

      if (!target) return fail("NOT_FOUND", "User not found");

      if (user.id === target.id) {
        return fail("BAD_REQUEST", "Cannot ban yourself");
      }

      await db
        .update(users)
        .set({ isBanned: data.banned })
        .where(eq(users.id, target.id));

      await bumpPermsRev(db, target.id);
      invalidateUserCache(target.tokenIdentifier);
      return ok({ ok: true });
    }),
  );

export const listUsers = createServerFn({ method: "POST" })
  .validator(listUsersArgsSchema)
  .handler(({ data }) =>
    authedFn({ admin: true }, data, async ({ db }) => {
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
    }),
  );
