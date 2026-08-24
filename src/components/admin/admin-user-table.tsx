import { AlertCircle, Search } from "lucide-react";

import type { DynamicRbacRole } from "@/components/admin/use-admin-users";
import { AdminRoleDialog } from "@/components/admin/admin-role-dialog";
import { AdminUserRow } from "@/components/admin/admin-user-row";
import { useAdminUsers } from "@/components/admin/use-admin-users";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

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
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
            key={`user-skeleton-${i}`}
            className="h-20 w-full rounded-xl"
          />
        ))}
      </div>
    );
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
            className="h-9 rounded-xl pl-9 text-sm"
          />
        </div>
        <div
          role="tablist"
          aria-label="User filter tabs"
          className="bg-muted/40 grid w-full shrink-0 grid-cols-3 gap-1 rounded-xl border p-1 sm:flex sm:w-auto"
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
                  ? "bg-background text-foreground shadow-sm"
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

      <div className="hidden overflow-hidden rounded-xl border md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  User
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Status
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Roles
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold tracking-wider uppercase">
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
          <div className="text-muted-foreground rounded-xl border py-10 text-center text-sm">
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
