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
			{/* Header */}
			<div className="bg-background/80 backdrop-blur-sm sticky top-0 z-10">
				<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
					<div className="flex items-center gap-3 py-4">
						<div className="md:hidden">
							<GoBack title="Back" hideLabelOnMobile />
						</div>
						<div className="flex items-center gap-2.5">
							{/* <div className="flex size-9 items-center justify-center rounded-xl bg-foreground/10">
								<LayoutDashboard className="size-4.5 text-foreground" />
							</div> */}
							<div>
								<h1 className="font-bold text-lg leading-tight tracking-tight">
									Admin Dashboard
								</h1>
								<p className="text-xs text-muted-foreground hidden sm:block">
									Manage users and feature permissions
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
				{/* Tab Navigation */}
				<div className="flex gap-1 rounded-xl border bg-muted/40 p-1 w-fit">
					{tabs.map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => setTab(t.id)}
							className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
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

				{/* Tab Content */}
				<div>
					{tab === "users" && <AdminUserTable />}
					{tab === "permissions" && <AdminPermissionToggles />}
				</div>
			</div>
		</div>
	);
}
