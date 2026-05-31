import { useState } from "react";
import { Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUserTable } from "@/components/admin/admin-user-table";
import { AdminPermissionToggles } from "@/components/admin/admin-permission-toggles";

export function AdminDashboard() {
	const [tab, setTab] = useState("users");

	return (
		<div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8 animate-fade-in">
			<div className="mx-auto max-w-5xl space-y-8">
				<div className="flex items-center gap-3">
					<Shield className="size-7 text-foreground" />
					<h1 className="font-bold text-3xl tracking-tight">Admin Dashboard</h1>
				</div>

				<Tabs value={tab} onValueChange={setTab}>
					<TabsList className="h-9 rounded-lg bg-transparent ring-1 ring-border px-0.5">
						<TabsTrigger
							value="users"
							className="h-7 px-3.5 text-xs font-semibold data-[state=active]:bg-secondary data-[state=active]:shadow-none"
						>
							Users
						</TabsTrigger>
						<TabsTrigger
							value="permissions"
							className="h-7 px-3.5 text-xs font-semibold data-[state=active]:bg-secondary data-[state=active]:shadow-none"
						>
							Feature Permissions
						</TabsTrigger>
					</TabsList>

					<TabsContent value="users" className="mt-6">
						<AdminUserTable />
					</TabsContent>

					<TabsContent value="permissions" className="mt-6">
						<AdminPermissionToggles />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
