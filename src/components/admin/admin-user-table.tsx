import { AlertCircle, Search } from "lucide-react";

import type { DynamicRbacRole } from "@/components/admin/use-admin-users";
import { AdminRoleDialog } from "@/components/admin/admin-role-dialog";
import { AdminUserRow } from "@/components/admin/admin-user-row";
import { useAdminUsers } from "@/components/admin/use-admin-users";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = ["sk-r1", "sk-r2", "sk-r3", "sk-r4", "sk-r5"];
const SKELETON_CARDS = ["sk-c1", "sk-c2", "sk-c3", "sk-c4"];

export function AdminUserTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search & filter tabs skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <Skeleton className="h-9 w-full rounded-md sm:w-64" />
      </div>

      {/* Desktop Table skeleton */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Users loading</caption>
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-12" />
                </th>
                <th className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-14" />
                </th>
                <th className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-12" />
                </th>
                <th className="px-4 py-3 text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SKELETON_ROWS.map((key) => (
                <tr key={key} className="h-16">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28 rounded" />
                        <Skeleton className="h-3 w-40 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-6 w-20 rounded-md" />
                      <Skeleton className="h-6 w-24 rounded-md" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Skeleton className="ml-auto h-7 w-16 rounded-md" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card skeleton */}
      <div className="space-y-3 md:hidden">
        {SKELETON_CARDS.map((key) => (
          <div key={key} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-3 w-36 rounded" />
                </div>
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="flex items-center gap-2 border-t pt-2">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="ml-auto h-7 w-14 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminUserTable() {
  const {
    users,
    loading,
    filteredUsers,
    filterTabs,
    search,
    setSearch,
    filterTab,
    setFilterTab,
    roleError,
    setRoleError,
    selectedUser,
    setSelectedUser,
    isSubmitting,
    errorMessage,
    handleConfirmBanToggle,
    isSelf,
    toggleRole,
    promptBanToggle,
    setUserRolesMutation,
  } = useAdminUsers();

  if (loading || users === undefined) {
    return <AdminUserTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {roleError && (
        <ErrorBanner className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{roleError}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setRoleError(null)}
          >
            Dismiss
          </Button>
        </ErrorBanner>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-md text-sm [&>input]:ps-8.5"
          />
        </div>
        <div
          role="tablist"
          aria-label="User filter tabs"
          className="bg-muted/40 grid w-full shrink-0 grid-cols-3 gap-1 rounded-md border p-1 sm:flex sm:w-auto"
        >
          {filterTabs.map((ft) => (
            <button
              key={ft.id}
              type="button"
              role="tab"
              aria-selected={filterTab === ft.id}
              onClick={() => setFilterTab(ft.id)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                filterTab === ft.id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ft.label}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                  filterTab === ft.id
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {ft.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Users</caption>
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium">
                  User
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium">
                  Status
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium">
                  Roles
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-muted-foreground py-10 text-center text-sm"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <AdminUserRow
                    key={user._id}
                    user={user}
                    isSelf={isSelf(user)}
                    isBanned={user.isBanned}
                    canModify={!isSelf(user) && !user.isAdmin}
                    isRolePending={setUserRolesMutation.isPending}
                    onToggleRole={(role: DynamicRbacRole) =>
                      toggleRole(user, role)
                    }
                    onPromptBanToggle={promptBanToggle}
                    variant="desktop"
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredUsers.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
            No users found
          </div>
        ) : (
          filteredUsers.map((user) => (
            <AdminUserRow
              key={user._id}
              user={user}
              isSelf={isSelf(user)}
              isBanned={user.isBanned}
              canModify={!isSelf(user) && !user.isAdmin}
              isRolePending={setUserRolesMutation.isPending}
              onToggleRole={(role: DynamicRbacRole) => toggleRole(user, role)}
              onPromptBanToggle={promptBanToggle}
              variant="mobile"
            />
          ))
        )}
      </div>

      {filteredUsers.length > 0 && (
        <p className="text-muted-foreground pt-2 pb-6 text-center text-xs">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      )}

      <AdminRoleDialog
        selectedUser={selectedUser}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onConfirm={handleConfirmBanToggle}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setSelectedUser(null);
          }
        }}
      />
    </div>
  );
}
