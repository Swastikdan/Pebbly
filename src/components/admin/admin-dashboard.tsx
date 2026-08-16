import { ToggleLeft, Users } from "lucide-react";
import { useState } from "react";
import { AdminPermissionToggles } from "@/components/admin/admin-permission-toggles";
import { AdminUserTable } from "@/components/admin/admin-user-table";
import { GoBack } from "@/components/go-back";

type Tab = "users" | "permissions";

export function AdminDashboard() {
	const [tab, setTab] = useState<Tab>("users");
	const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
		{ id: "users", label: "Users", icon: Users },
		{ id: "permissions", label: "Feature Flags", icon: ToggleLeft },
	];

	return (
		<div className="min-h-screen animate-fade-in">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-3">
				<GoBack title="Back" hideLabelOnMobile />
			</div>

			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-8 space-y-6">
				{/* Admin Dashboard Title + Tab Navigation */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h1 className="font-bold text-xl sm:text-2xl leading-tight tracking-tight">
							Admin Dashboard
						</h1>
						<p className="text-xs text-muted-foreground mt-0.5">
							Manage users and feature permissions
						</p>
					</div>

					<div className="grid grid-cols-2 sm:flex gap-1 rounded-xl border bg-muted/40 p-1 w-full sm:w-fit">
						{tabs.map((t) => (
							<button
								key={t.id}
								type="button"
								onClick={() => setTab(t.id)}
								className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
									tab === t.id
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<t.icon className="size-3.5" />
								<span>{t.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* Tab Content */}
				<div>
					{tab === "users" && <AdminUserTable />}
					{tab === "permissions" && <AdminPermissionToggles />}
				</div>
			</div>
		</div>
	);
}
