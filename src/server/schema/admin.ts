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

const tokenIdentifierSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(255),
);

export const setUserRolesArgsSchema = v.object({
  tokenIdentifier: tokenIdentifierSchema,
  // One entry per assignable role; bounds the JSON stored in `users.roles`.
  roles: v.pipe(
    v.array(v.picklist(["ai-integrations", "external-redirect"])),
    v.maxLength(2),
  ),
});
export type SetUserRolesArgs = v.InferOutput<typeof setUserRolesArgsSchema>;

export const setUserBannedArgsSchema = v.object({
  tokenIdentifier: tokenIdentifierSchema,
  banned: v.boolean(),
});
export type SetUserBannedArgs = v.InferOutput<typeof setUserBannedArgsSchema>;

export const listUsersArgsSchema = v.object({
  limit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(200)),
  ),
});
export type ListUsersArgs = v.InferOutput<typeof listUsersArgsSchema>;
