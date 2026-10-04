import { AlertTriangle, ExternalLink, Zap } from "@/components/ui/hugeicons";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PermissionRole, RbacFeature } from "@/constants";
import { ErrorBanner } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { RBAC_FEATURES } from "@/constants";
import { destructiveToast } from "@/lib/notifications";
import { queryKeys } from "@/lib/query/keys";
import { getRolePermissions, setRolePermission } from "@/server/fns/admin";
import { unwrap } from "@/server/schema/common";

const FEATURE_ROLES: Record<RbacFeature, PermissionRole> = {
  "ai-recommendations": "ai-integrations",
  "external-redirect": "external-redirect",
};

const FEATURE_ICONS: Record<RbacFeature, typeof Zap> = {
  "ai-recommendations": Zap,
  "external-redirect": ExternalLink,
};

function ToggleSwitch({
  enabled,
  label,
  onChange,
}: {
  enabled: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={`${label} permission`}
      aria-checked={enabled}
      onClick={() => {
        onChange(!enabled);
      }}
      className={`focus-visible:ring-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden ${
        enabled ? "bg-foreground" : "bg-muted-foreground/20 ring-border ring-1"
      } cursor-pointer`}
    >
      <span
        className={`bg-background ring-border/50 inline-block size-4 transform rounded-full ring-1 transition-transform duration-150 ${
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
    <div className="bg-card hover:bg-muted/20 flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors">
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
          <Icon aria-hidden="true" className="text-foreground size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{featureLabel}</p>
          <p className="text-muted-foreground truncate text-xs">{feature}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`min-w-14 text-end text-xs font-semibold ${
            enabled ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
        <ToggleSwitch
          enabled={enabled}
          label={featureLabel}
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
      // A global flag change affects the admin's own effective features too,
      // so refresh the current user's permissions immediately instead of
      // waiting for the next data-version poll.
      void queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
    onError: (error) => {
      setToggleError(
        error instanceof Error ? error.message : "Failed to update permission",
      );
    },
  });

  const rawPermissionsData = rawPermissions.data;
  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Map<RbacFeature, boolean>
  >(new Map());

  const permissionsByRole = rawPermissionsData as
    | Record<PermissionRole, Record<RbacFeature, boolean>>
    | undefined;

  const effectivePermissionsByRole = useMemo(() => {
    if (!permissionsByRole) return undefined;
    const next: Record<PermissionRole, Record<RbacFeature, boolean>> = {
      "ai-integrations": { ...permissionsByRole["ai-integrations"] },
      "external-redirect": { ...permissionsByRole["external-redirect"] },
    };
    for (const [feat, enabled] of optimisticOverrides) {
      const role = FEATURE_ROLES[feat];
      if (next[role]) {
        next[role][feat] = enabled;
      }
    }
    return next;
  }, [permissionsByRole, optimisticOverrides]);

  const handleToggle = (
    feature: RbacFeature,
    featureLabel: string,
    enabled: boolean,
  ) => {
    // 1. Immediately optimistic on client (0ms)
    setOptimisticOverrides((prev) => new Map(prev).set(feature, enabled));

    if (!enabled) {
      // Destructive: disabling global feature
      destructiveToast({
        title: `${featureLabel} disabled`,
        description: "Global feature turned off",
        onUndo: () => {
          // Revert client state immediately - 0 server calls
          setOptimisticOverrides((prev) => {
            const next = new Map(prev);
            next.set(feature, true);
            return next;
          });
        },
        onConfirm: () => {
          setRolePermissionMutation.mutate({
            feature,
            enabled: false,
          });
        },
      });
      return;
    }

    // Additive: enabling global feature
    setRolePermissionMutation.mutate({
      feature,
      enabled: true,
    });
  };

  if (rawPermissions.isError) {
    return <FeatureError onRetry={() => rawPermissions.refetch()} />;
  }

  if (effectivePermissionsByRole === undefined) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
              key={i}
              className="bg-card flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-md" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Skeleton className="h-4 w-14 rounded" />
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toggleError && <ErrorBanner>{toggleError}</ErrorBanner>}
      <div className="space-y-3">
        {Object.entries(RBAC_FEATURES).map(([feature, config]) => (
          <FeatureRow
            key={feature}
            feature={feature as RbacFeature}
            featureLabel={config.label}
            permissionsByRole={effectivePermissionsByRole}
            onToggle={(_role, enabled) =>
              handleToggle(feature as RbacFeature, config.label, enabled)
            }
          />
        ))}
      </div>

      <div className="border-border/60 bg-muted/30 flex items-start gap-2.5 rounded-lg border p-3">
        <AlertTriangle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-foreground text-xs font-semibold">
            Global Feature Flags
          </p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            These toggles enable or disable features globally. A feature is
            active only when its global flag is on <em>and</em> the user holds a
            role that grants it — for everyone, administrators included. There
            is no admin bypass.
          </p>
        </div>
      </div>
    </div>
  );
}
