import { ToggleLeft, Users } from "lucide-react";

import { AdminPermissionToggles } from "@/components/admin/admin-permission-toggles";
import { AdminUserTable } from "@/components/admin/admin-user-table";
import { GoBack } from "@/components/go-back";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AdminDashboard() {
  return (
    <div className="animate-fade-in min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
        <GoBack title="Back" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 pb-20 sm:px-6 sm:pb-8 lg:px-8">
        <Tabs defaultValue="users" className="gap-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl leading-tight font-bold tracking-tight sm:text-2xl">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-0.5 text-xs">
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
