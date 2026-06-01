import { useMutation, useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type PermissionRole,
	RBAC_FEATURES,
	type RbacFeature,
} from "@/constants";
import { api } from "../../../convex/_generated/api";

const ROLE_LABELS: Record<PermissionRole, string> = {
	"video-player": "Video",
	"ai-integrations": "AI",
};

const FEATURE_ROLES: Record<RbacFeature, PermissionRole> = {
	"video-player": "video-player",
	"ai-recommendations": "ai-integrations",
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
			className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
				enabled ? "bg-foreground" : "bg-muted-foreground/25 ring-1 ring-border"
			} cursor-pointer`}
		>
			<span
				className={`inline-block size-4 transform rounded-full bg-background shadow-sm ring-1 ring-border/50 transition-transform duration-200 ${
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
	return (
		<div className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-muted/30">
			<div>
				<p className="font-medium text-sm">{featureLabel}</p>
				<p className="text-xs text-muted-foreground">{feature}</p>
			</div>
			<div className="flex items-center gap-6">
				<div className="flex flex-col items-center gap-1 min-w-16">
					<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
						{ROLE_LABELS[role]}
					</span>
					<ToggleSwitch
						enabled={enabled}
						onChange={(nextEnabled) => onToggle(role, nextEnabled)}
					/>
				</div>
			</div>
		</div>
	);
}

export function AdminPermissionToggles() {
	const rawPermissions = useQuery(api.admin.getRolePermissions, {});
	const setRolePermission = useMutation(api.admin.setRolePermission);

	if (rawPermissions === undefined) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-16 w-full rounded-lg" />
				<Skeleton className="h-16 w-full rounded-lg" />
			</div>
		);
	}

	const permissionsByRole = rawPermissions as Record<
		PermissionRole,
		Record<RbacFeature, boolean>
	>;

	return (
		<div className="rounded-xl border">
			<div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
				<h2 className="font-semibold text-sm">Feature Permissions</h2>
				<div className="flex items-center gap-6">
					<span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold min-w-16 text-center">
						Permission
					</span>
				</div>
			</div>

			<div className="divide-y">
				{Object.entries(RBAC_FEATURES).map(([feature, config]) => (
					<FeatureRow
						key={feature}
						feature={feature as RbacFeature}
						featureLabel={config.label}
						permissionsByRole={permissionsByRole}
						onToggle={(role, enabled) =>
							setRolePermission({ role, feature, enabled })
						}
					/>
				))}
			</div>

			<div className="border-t px-4 py-3">
				<p className="text-xs text-muted-foreground">
					Admin access is managed in Clerk. These toggles only update Convex
					permissions for dynamic roles.
				</p>
			</div>
		</div>
	);
}
