import { useMutation, useQuery } from "convex/react";
import {
	RBAC_FEATURES,
	RBAC_ROLES,
	type RbacFeature,
	type RbacRole,
} from "@/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../convex/_generated/api";

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
			onClick={() => onChange(!enabled)}
			className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
				enabled ? "bg-foreground" : "bg-muted-foreground/25 ring-1 ring-border"
			}`}
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
	permissionsByRole: Record<RbacRole, Record<RbacFeature, boolean>>,
	feature: RbacFeature,
): Record<RbacRole, boolean> {
	const result = {} as Record<RbacRole, boolean>;
	for (const role of RBAC_ROLES) {
		result[role] = permissionsByRole[role]?.[feature] ?? false;
	}
	return result;
}

function FeatureRow({
	feature,
	featureLabel,
	permissionsByRole,
	onToggle,
}: {
	feature: RbacFeature;
	featureLabel: string;
	permissionsByRole: Record<RbacRole, Record<RbacFeature, boolean>>;
	onToggle: (role: RbacRole, enabled: boolean) => void;
}) {
	const perms = featurePermissions(permissionsByRole, feature);
	return (
		<div className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-muted/30">
			<div>
				<p className="font-medium text-sm">{featureLabel}</p>
				<p className="text-xs text-muted-foreground">{feature}</p>
			</div>
			<div className="flex items-center gap-6">
				{RBAC_ROLES.map((role) => (
					<div key={role} className="flex flex-col items-center gap-1 min-w-16">
						<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
							{role === "ai-integrations" ? "AI" : "Admin"}
						</span>
						<ToggleSwitch
							enabled={perms[role]}
							onChange={(enabled) => onToggle(role, enabled)}
						/>
					</div>
				))}
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
		RbacRole,
		Record<RbacFeature, boolean>
	>;

	return (
		<div className="rounded-xl border">
			<div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
				<h2 className="font-semibold text-sm">Role Permissions</h2>
				<div className="flex items-center gap-6">
					{RBAC_ROLES.map((role) => (
						<span
							key={role}
							className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold min-w-16 text-center"
						>
							{role === "ai-integrations" ? "AI" : "Admin"}
						</span>
					))}
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
					Toggle permissions per role. Changes take effect immediately for all
					users with that role.
				</p>
			</div>
		</div>
	);
}
