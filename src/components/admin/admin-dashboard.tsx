import { ToggleLeft, Users } from "lucide-react";
import { AdminPermissionToggles } from "@/components/admin/admin-permission-toggles";
import { AdminUserTable } from "@/components/admin/admin-user-table";
import { GoBack } from "@/components/go-back";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AdminDashboard() {
	return (
		<div className="min-h-screen animate-fade-in">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-3">
				<GoBack title="Back" hideLabelOnMobile />
			</div>

			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-8">
				<Tabs defaultValue="users" className="gap-6">
					{/* Dashboard Title + Tab Navigation */}
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<h1 className="font-bold text-xl sm:text-2xl leading-tight tracking-tight">
								Admin Dashboard
							</h1>
							<p className="text-xs text-muted-foreground mt-0.5">
								Manage users and feature permissions
							</p>
						</div>

						<TabsList className="w-full max-w-sm sm:w-fit">
							<TabsTrigger value="users">
								<Users size={15} />
								Users
							</TabsTrigger>
							<TabsTrigger value="permissions">
								<ToggleLeft size={15} />
								Feature Flags
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="users">
						<AdminUserTable />
					</TabsContent>

					<TabsContent value="permissions">
						<AdminPermissionToggles />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
