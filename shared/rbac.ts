export const RBAC_ROLES = ["admin", "video-player", "ai-integrations"] as const;
export type RbacRole = (typeof RBAC_ROLES)[number];

export const PERMISSION_ROLES = ["video-player", "ai-integrations"] as const;
export type PermissionRole = (typeof PERMISSION_ROLES)[number];

export const RBAC_FEATURES = {
	"video-player": {
		label: "Video Playback",
		description: "Built-in video player modal for streaming content",
	},
	"ai-recommendations": {
		label: "AI Recommendations",
		description:
			"AI-powered personalized movie and TV recommendations via Gemini",
	},
} as const;
export type RbacFeature = keyof typeof RBAC_FEATURES;

export const RBAC_ROLE_FEATURES: Record<PermissionRole, RbacFeature> = {
	"video-player": "video-player",
	"ai-integrations": "ai-recommendations",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<
	PermissionRole,
	Record<RbacFeature, boolean>
> = {
	"video-player": {
		"video-player": true,
		"ai-recommendations": false,
	},
	"ai-integrations": {
		"video-player": false,
		"ai-recommendations": true,
	},
};

export const ADMIN_PERMISSIONS: Record<RbacFeature, true> = {
	"video-player": true,
	"ai-recommendations": true,
};
