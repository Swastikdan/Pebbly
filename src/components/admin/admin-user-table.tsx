import { AlertCircle, Search } from "lucide-react";
import { AdminRoleDialog } from "@/components/admin/admin-role-dialog";
import { AdminUserRow } from "@/components/admin/admin-user-row";
import {
	type DynamicRbacRole,
	useAdminUsers,
} from "@/components/admin/use-admin-users";
import { Button } from "@/components/ui/button";
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
				<div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
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
				</div>
			)}

			{/* Search + Filter */}
			<div className="flex flex-col sm:flex-row gap-3">
				<div className="relative flex-1">
					<Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input
						placeholder="Search users..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9 h-9 rounded-xl text-sm"
					/>
				</div>
				<div
					role="tablist"
					aria-label="User filter tabs"
					className="grid grid-cols-3 sm:flex gap-1 rounded-xl border bg-muted/40 p-1 shrink-0 w-full sm:w-auto"
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
								className={`text-[10px] rounded-md px-1.5 py-0.5 ${
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

			{/* Desktop Table */}
			<div className="hidden md:block rounded-xl border overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/40">
								<th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
									User
								</th>
								<th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
									Status
								</th>
								<th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
									Roles
								</th>
								<th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							{filteredUsers.length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className="py-10 text-center text-muted-foreground text-sm"
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

			{/* Mobile Cards */}
			<div className="md:hidden space-y-3">
				{filteredUsers.length === 0 ? (
					<div className="rounded-xl border py-10 text-center text-muted-foreground text-sm">
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
				<p className="text-xs text-muted-foreground text-center pt-2 pb-6">
					Showing {filteredUsers.length} of {users.length} users
				</p>
			)}

			{/* Ban / Unban Confirmation Dialog */}
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
