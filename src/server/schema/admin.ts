import * as v from "valibot";

import { VALID_FEATURES } from "../rbac";

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
  limit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(200)),
  ),
});
export type ListUsersArgs = v.InferOutput<typeof listUsersArgsSchema>;
