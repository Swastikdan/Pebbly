import { useMutation, useQuery } from "convex/react";
import { Check, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RbacRole } from "@/constants";
import { api } from "../../../convex/_generated/api";

type DynamicRbacRole = Exclude<RbacRole, "admin">;

const ROLE_CONFIGS: { value: DynamicRbacRole; label: string }[] = [
	{ value: "video-player", label: "Video Player" },
	{ value: "ai-integrations", label: "AI Integrations" },
];

function RoleBadge({ roles }: { roles: RbacRole[] }) {
	if (roles.length === 0) {
		return <span className="text-sm text-muted-foreground">—</span>;
	}

	const colors: Partial<Record<RbacRole, string>> = {
		"video-player":
			"bg-emerald-100/90 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
		"ai-integrations":
			"bg-blue-100/90 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	};

	return (
		<div className="flex flex-wrap gap-1">
			{roles.map((role) => (
				<Badge key={role} className={colors[role]}>
					{role === "video-player"
						? "Video"
						: role === "ai-integrations"
							? "AI"
							: role}
				</Badge>
			))}
		</div>
	);
}

export function AdminUserTable() {
	const users = useQuery(api.admin.listUsers, {});
	const setUserRoles = useMutation(api.admin.setUserRoles);

	if (users === undefined) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-10 w-full rounded-lg" />
				<Skeleton className="h-10 w-full rounded-lg" />
				<Skeleton className="h-10 w-full rounded-lg" />
			</div>
		);
	}

	return (
		<div className="rounded-xl border">
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/50">
							<th className="px-4 py-3 text-left font-semibold">User</th>
							<th className="px-4 py-3 text-left font-semibold">Email</th>
							<th className="px-4 py-3 text-left font-semibold">Roles</th>
							<th className="px-4 py-3 text-right font-semibold">Actions</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user) => {
							const currentRoles = (user.roles ?? []).filter(
								(role) => role === "video-player" || role === "ai-integrations",
							) as DynamicRbacRole[];

							return (
								<tr
									key={user._id}
									className="border-b last:border-0 hover:bg-muted/30"
								>
									<td className="px-4 py-3">
										<div className="flex items-center gap-3">
											{user.image ? (
												<img
													src={user.image}
													alt={user.name}
													className="size-8 rounded-full"
												/>
											) : (
												<div className="flex size-8 items-center justify-center rounded-full bg-secondary">
													<UserCog className="size-4 text-muted-foreground" />
												</div>
											)}
											<span className="font-medium">{user.name}</span>
										</div>
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{user.email}
									</td>
									<td className="px-4 py-3">
										<RoleBadge roles={currentRoles} />
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex items-center justify-end gap-1.5">
											{ROLE_CONFIGS.map((config) => {
												const isActive = currentRoles.includes(config.value);

												const toggleRole = () => {
													const next = isActive
														? currentRoles.filter((r) => r !== config.value)
														: [...currentRoles, config.value];
													setUserRoles({
														tokenIdentifier: user.tokenIdentifier,
														roles: next,
													}).catch((err) => {
														alert(
															err instanceof Error ? err.message : String(err),
														);
													});
												};

												return (
													<Button
														key={config.value}
														variant={isActive ? "secondary" : "outline"}
														size="sm"
														className="h-7 rounded-lg px-2.5 text-xs"
														onClick={toggleRole}
													>
														{isActive && <Check className="mr-1 size-3" />}
														{config.label}
													</Button>
												);
											})}
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
