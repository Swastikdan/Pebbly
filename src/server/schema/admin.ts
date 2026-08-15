import { z } from "zod";

export const setRolePermissionArgsSchema = z.object({
	role: z.string(),
	feature: z.string(),
	enabled: z.boolean(),
});
export type SetRolePermissionArgs = z.infer<typeof setRolePermissionArgsSchema>;

export const setUserRolesArgsSchema = z.object({
	tokenIdentifier: z.string(),
	roles: z.array(z.enum(["video-player", "ai-integrations"])),
});
export type SetUserRolesArgs = z.infer<typeof setUserRolesArgsSchema>;

export const setUserBannedArgsSchema = z.object({
	tokenIdentifier: z.string(),
	banned: z.boolean(),
});
export type SetUserBannedArgs = z.infer<typeof setUserBannedArgsSchema>;

export const listUsersArgsSchema = z.object({
	limit: z.number().optional(),
});
export type ListUsersArgs = z.infer<typeof listUsersArgsSchema>;
