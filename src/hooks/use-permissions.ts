import { useUser } from "@clerk/react";
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import type { RbacFeature, RbacRole } from "@/constants";
import { queryKeys } from "@/lib/query/keys";
import { getUserFeaturesFn } from "@/server/fns/admin";
import { unwrap } from "@/server/schema/common";

interface PermissionState {
  roles: RbacRole[];
  features: Record<RbacFeature, boolean>;
  isAdmin: boolean;
  isBanned: boolean;
  loading: boolean;
  isSignedIn: boolean;
}

export function usePermissions(): PermissionState & {
  hasFeature: (feature: RbacFeature) => boolean;
  hasRole: (role: RbacRole) => boolean;
} {
  const { isSignedIn, isLoaded, user } = useUser();
  const raw = useQuery({
    queryKey: queryKeys.permissions(user?.id ?? "anonymous"),
    queryFn: () => unwrap(getUserFeaturesFn()),
    enabled: !!isSignedIn,
    refetchOnWindowFocus: true,
  });

  const clerkIsAdmin = user?.publicMetadata?.isAdmin === true;
  const loading = !isLoaded || (isSignedIn && raw.isPending);

  const isBanned = raw.data?.isBanned === true;

  const features = clerkIsAdmin
    ? ({
        "video-player": true,
        "ai-recommendations": true,
        "external-redirect": raw.data?.features?.["external-redirect"] === true,
      } as Record<RbacFeature, boolean>)
    : isBanned
      ? ({
          "video-player": false,
          "ai-recommendations": false,
          "external-redirect": false,
        } as Record<RbacFeature, boolean>)
      : ((raw.data?.features ?? {}) as Record<RbacFeature, boolean>);

  const roles = clerkIsAdmin
    ? ((raw.data?.roles ?? ["admin"]) as RbacRole[])
    : ((raw.data?.roles ?? []) as RbacRole[]);

  const isAdmin = clerkIsAdmin;

  const hasFeature = useCallback(
    (feature: RbacFeature): boolean => {
      if (isBanned) return false;
      return features[feature] === true;
    },
    [features, isBanned],
  );

  const hasRole = useCallback(
    (role: RbacRole): boolean => {
      if (isBanned) return false;
      return roles.includes(role);
    },
    [roles, isBanned],
  );

  return {
    roles,
    features,
    isAdmin,
    isBanned,
    loading,
    isSignedIn: !!isSignedIn,
    hasFeature,
    hasRole,
  };
}
