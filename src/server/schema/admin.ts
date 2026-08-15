import * as v from "valibot";

export const setRolePermissionArgsSchema = v.object({
	role: v.string(),
	feature: v.string(),
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
	limit: v.optional(v.number()),
});
export type ListUsersArgs = v.InferOutput<typeof listUsersArgsSchema>;
