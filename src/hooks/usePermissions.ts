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
	const { isSignedIn, isLoaded } = useUser();
	const raw = useQuery(
		api.admin.getUserFeatures,
		isSignedIn ? {} : QUERY_SKIP,
	) as UserFeaturesResult | undefined;

	const loading = !isLoaded || (isSignedIn && raw === undefined);

	const features = (raw?.features ?? {}) as Record<RbacFeature, boolean>;
	const roles = (raw?.roles ?? []) as RbacRole[];
	const isAdmin = raw?.isAdmin ?? false;

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
