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
    // Scope by the authenticated user so cached permissions can never leak
    // across accounts.
    queryKey: queryKeys.permissions(user?.id ?? "anonymous"),
    queryFn: () => unwrap(getUserFeaturesFn()),
    enabled: !!isSignedIn,
    // No fixed interval: UserSync invalidates this query whenever the
    // per-user `permsRev` counter moves (role/ban/feature-flag changes),
    // and it refetches on window focus. This replaces the old 30s poll.
    refetchOnWindowFocus: true,
  });

  const clerkIsAdmin = user?.publicMetadata?.isAdmin === true;
  const loading = !isLoaded || (isSignedIn && !clerkIsAdmin && raw.isPending);

  const isBanned = raw.data?.isBanned === true;

  const features = clerkIsAdmin
    ? ({
        "video-player": true,
        "ai-recommendations": true,
      } as Record<RbacFeature, boolean>)
    : isBanned
      ? ({
          "video-player": false,
          "ai-recommendations": false,
        } as Record<RbacFeature, boolean>)
      : ((raw.data?.features ?? {}) as Record<RbacFeature, boolean>);

  const roles = clerkIsAdmin
    ? (["admin"] as RbacRole[])
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
