import * as v from "valibot";

import { VALID_FEATURES } from "../rbac";

// Derived from the RBAC constants so the schema can never drift from the
// features the server actually understands. `role` is intentionally absent:
// the permission toggles are global feature flags (always role "global"), so
// the client cannot submit a role that the handler would ignore.
export const rbacFeatureSchema = v.picklist([...VALID_FEATURES]);

export const setRolePermissionArgsSchema = v.object({
  feature: rbacFeatureSchema,
  enabled: v.boolean(),
});
export type SetRolePermissionArgs = v.InferOutput<
  typeof setRolePermissionArgsSchema
>;

export const setUserRolesArgsSchema = v.object({
  tokenIdentifier: v.string(),
  roles: v.array(v.picklist(["video-player", "ai-integrations"])),
});
export type SetUserRolesArgs = v.InferOutput<typeof setUserRolesArgsSchema>;

export const setUserBannedArgsSchema = v.object({
  tokenIdentifier: v.string(),
  banned: v.boolean(),
});
export type SetUserBannedArgs = v.InferOutput<typeof setUserBannedArgsSchema>;

export const listUsersArgsSchema = v.object({
  // Non-negative, bounded so a client cannot trigger unbounded D1 reads.
  limit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(200)),
  ),
});
export type ListUsersArgs = v.InferOutput<typeof listUsersArgsSchema>;
