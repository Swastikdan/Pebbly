import { Activity, AlertTriangle, Zap } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PermissionRole, RbacFeature } from "@/constants";
import { ErrorBanner } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { RBAC_FEATURES } from "@/constants";
import { queryKeys } from "@/lib/query/keys";
import { getRolePermissions, setRolePermission } from "@/server/fns/admin";
import { unwrap } from "@/server/schema/common";

const FEATURE_ROLES: Record<RbacFeature, PermissionRole> = {
  "video-player": "video-player",
  "ai-recommendations": "ai-integrations",
};

const FEATURE_ICONS: Record<RbacFeature, typeof Activity> = {
  "video-player": Activity,
  "ai-recommendations": Zap,
};

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => {
        onChange(!enabled);
      }}
      className={`focus-visible:ring-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
        enabled
          ? "bg-foreground shadow-sm"
          : "bg-muted-foreground/20 ring-border ring-1"
      } cursor-pointer`}
    >
      <span
        className={`bg-background ring-border/50 inline-block size-4 transform rounded-full shadow-sm ring-1 transition-transform duration-150 ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function featurePermissions(
  permissionsByRole: Record<PermissionRole, Record<RbacFeature, boolean>>,
  feature: RbacFeature,
): boolean {
  const role = FEATURE_ROLES[feature];
  return permissionsByRole[role]?.[feature] ?? false;
}

function FeatureError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorBanner className="flex items-center justify-between gap-3">
      <span>Failed to load permission settings.</span>
      <button
        type="button"
        onClick={onRetry}
        className="bg-destructive/15 hover:bg-destructive/25 rounded-lg px-2.5 py-1 font-semibold"
      >
        Retry
      </button>
    </ErrorBanner>
  );
}

function FeatureRow({
  feature,
  featureLabel,
  permissionsByRole,
  onToggle,
}: {
  feature: RbacFeature;
  featureLabel: string;
  permissionsByRole: Record<PermissionRole, Record<RbacFeature, boolean>>;
  onToggle: (role: PermissionRole, enabled: boolean) => void;
}) {
  const role = FEATURE_ROLES[feature];
  const enabled = featurePermissions(permissionsByRole, feature);
  const Icon = FEATURE_ICONS[feature];

  return (
    <div className="bg-card hover:bg-muted/20 flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors">
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-xl">
          <Icon className="text-foreground size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{featureLabel}</p>
          <p className="text-muted-foreground truncate text-xs">{feature}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`min-w-[3.5rem] text-right text-xs font-semibold ${
            enabled ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
        <ToggleSwitch
          enabled={enabled}
          onChange={(nextEnabled) => onToggle(role, nextEnabled)}
        />
      </div>
    </div>
  );
}

export function AdminPermissionToggles() {
  const queryClient = useQueryClient();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const rawPermissions = useQuery({
    queryKey: queryKeys.admin.rolePermissions(),
    queryFn: () => unwrap(getRolePermissions()),
  });
  const setRolePermissionMutation = useMutation({
    mutationFn: (args: { feature: RbacFeature; enabled: boolean }) =>
      unwrap(setRolePermission({ data: args })),
    onSuccess: () => {
      setToggleError(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.rolePermissions(),
      });
    },
    onError: (error) => {
      setToggleError(
        error instanceof Error ? error.message : "Failed to update permission",
      );
    },
  });

  const rawPermissionsData = rawPermissions.data;

  if (rawPermissions.isError) {
    return <FeatureError onRetry={() => rawPermissions.refetch()} />;
  }

  if (rawPermissionsData === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  const permissionsByRole = rawPermissionsData as Record<
    PermissionRole,
    Record<RbacFeature, boolean>
  >;

  return (
    <div className="space-y-4">
      {toggleError && <ErrorBanner>{toggleError}</ErrorBanner>}
      <div className="space-y-3">
        {Object.entries(RBAC_FEATURES).map(([feature, config]) => (
          <FeatureRow
            key={feature}
            feature={feature as RbacFeature}
            featureLabel={config.label}
            permissionsByRole={permissionsByRole}
            onToggle={(_role, enabled) =>
              setRolePermissionMutation.mutate({
                feature: feature as RbacFeature,
                enabled,
              })
            }
          />
        ))}
      </div>

      <div className="border-border/60 bg-muted/30 flex items-start gap-2.5 rounded-xl border p-3">
        <AlertTriangle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-foreground text-xs font-semibold">
            Global Feature Flags
          </p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            These toggles enable or disable features globally. If disabled, a
            feature will not work for users even if they have the required role,
            but it will still work for administrators.
          </p>
        </div>
      </div>
    </div>
  );
}
