import { useUser } from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import { useCallback } from "react";
import type { RbacFeature, RbacRole } from "@/constants";
import { api } from "../../convex/_generated/api";

const QUERY_SKIP = "skip" as const;

interface UserFeaturesResult {
	roles: string[];
	features: Record<string, boolean>;
	isAdmin: boolean;
}

interface PermissionState {
	roles: RbacRole[];
	features: Record<RbacFeature, boolean>;
	isAdmin: boolean;
	loading: boolean;
	isSignedIn: boolean;
}

export function usePermissions(): PermissionState & {
	hasFeature: (feature: RbacFeature) => boolean;
	hasRole: (role: RbacRole) => boolean;
} {
	const { isSignedIn, isLoaded, user } = useUser();
	const raw = useQuery(
		api.admin.getUserFeatures,
		isSignedIn ? {} : QUERY_SKIP,
	) as UserFeaturesResult | undefined;

	const clerkIsAdmin = user?.publicMetadata?.isAdmin === true;
	const loading =
		!isLoaded || (!!isSignedIn && !clerkIsAdmin && raw === undefined);

	const features = clerkIsAdmin
		? ({
				"video-player": true,
				"ai-recommendations": true,
			} as Record<RbacFeature, boolean>)
		: ((raw?.features ?? {}) as Record<RbacFeature, boolean>);
	const roles = clerkIsAdmin
		? (["admin"] as RbacRole[])
		: ((raw?.roles ?? []) as RbacRole[]);
	const isAdmin = clerkIsAdmin;

	const hasFeature = useCallback(
		(feature: RbacFeature): boolean => {
			return features[feature] === true;
		},
		[features],
	);

	const hasRole = useCallback(
		(role: RbacRole): boolean => {
			return roles.includes(role);
		},
		[roles],
	);

	return {
		roles,
		features,
		isAdmin,
		loading,
		isSignedIn: !!isSignedIn,
		hasFeature,
		hasRole,
	};
}
