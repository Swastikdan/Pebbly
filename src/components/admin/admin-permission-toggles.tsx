import { useMutation, useQuery } from "convex/react";
import { Activity, AlertTriangle, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type PermissionRole,
	RBAC_FEATURES,
	type RbacFeature,
} from "@/constants";
import { api } from "../../../convex/_generated/api";

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
			className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
				enabled
					? "bg-foreground shadow-sm"
					: "bg-muted-foreground/20 ring-1 ring-border"
			} cursor-pointer`}
		>
			<span
				className={`inline-block size-4 transform rounded-full bg-background shadow-sm ring-1 ring-border/50 transition-transform duration-300 ${
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
	const Icon = FEATURE_ICONS[feature];

	return (
		<div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/20">
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex size-9 items-center justify-center rounded-xl bg-muted shrink-0">
					<Icon className="size-4.5 text-foreground" />
				</div>
				<div className="min-w-0">
					<p className="font-semibold text-sm">{featureLabel}</p>
					<p className="text-xs text-muted-foreground truncate">{feature}</p>
				</div>
			</div>
			<div className="flex items-center gap-3 shrink-0">
				<span
					className={`text-xs font-semibold min-w-[3.5rem] text-right ${
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
	const rawPermissions = useQuery(api.admin.getRolePermissions, {});
	const setRolePermission = useMutation(api.admin.setRolePermission);

	if (rawPermissions === undefined) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-20 w-full rounded-xl" />
				<Skeleton className="h-20 w-full rounded-xl" />
			</div>
		);
	}

	const permissionsByRole = rawPermissions as Record<
		PermissionRole,
		Record<RbacFeature, boolean>
	>;

	return (
		<div className="space-y-4">
			<div className="space-y-3">
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

			<div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex gap-2.5 items-start">
				<AlertTriangle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
				<div className="space-y-0.5">
					<p className="text-xs font-semibold text-foreground">
						Global Feature Flags
					</p>
					<p className="text-[11px] leading-relaxed text-muted-foreground">
						These toggles enable or disable features globally. If disabled, a
						feature will not work for users even if they have the required role
						— but it will still work for administrators.
					</p>
				</div>
			</div>
		</div>
	);
}
