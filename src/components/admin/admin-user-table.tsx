import { useUser } from "@clerk/react";
import { useMutation, useQuery } from "convex/react";
import {
	AlertCircle,
	Ban,
	Check,
	Loader2,
	Search,
	ShieldCheck,
	UserCog,
	UserX,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { RbacRole } from "@/constants";
import { api } from "../../../convex/_generated/api";

type DynamicRbacRole = Exclude<RbacRole, "admin">;

const ROLE_CONFIGS: { value: DynamicRbacRole; label: string; short: string }[] =
	[
		{ value: "video-player", label: "Video Player", short: "Video" },
		{ value: "ai-integrations", label: "AI Integrations", short: "AI" },
	];

interface UserTarget {
	tokenIdentifier: string;
	name: string;
	email: string;
	isBanned: boolean;
}

type FilterTab = "all" | "active" | "banned";

export function AdminUserTable() {
	const { user: currentUser } = useUser();
	const users = useQuery(api.admin.listUsers, {});
	const setUserRoles = useMutation(api.admin.setUserRoles);
	const setUserBanned = useMutation(api.admin.setUserBanned);

	const [selectedUser, setSelectedUser] = useState<UserTarget | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [roleError, setRoleError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [filterTab, setFilterTab] = useState<FilterTab>("all");

	if (users === undefined) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton
						key={`user-skeleton-${i}`}
						className="h-20 w-full rounded-xl"
					/>
				))}
			</div>
		);
	}

	const handleConfirmBanToggle = async () => {
		if (!selectedUser) return;
		setIsSubmitting(true);
		setErrorMessage(null);

		try {
			await setUserBanned({
				tokenIdentifier: selectedUser.tokenIdentifier,
				banned: !selectedUser.isBanned,
			});
			setSelectedUser(null);
		} catch (err) {
			console.error("Ban user error:", err);
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to update user status",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const lowerSearch = search.toLowerCase().trim();
	const filteredUsers = users.filter((user) => {
		const matchesSearch =
			!lowerSearch ||
			user.name.toLowerCase().includes(lowerSearch) ||
			user.email.toLowerCase().includes(lowerSearch);

		const matchesFilter =
			filterTab === "all" ||
			(filterTab === "active" && !user.isBanned) ||
			(filterTab === "banned" && user.isBanned);

		return matchesSearch && matchesFilter;
	});

	const filterTabs: { id: FilterTab; label: string; count: number }[] = [
		{ id: "all", label: "All", count: users.length },
		{
			id: "active",
			label: "Active",
			count: users.filter((u) => !u.isBanned).length,
		},
		{
			id: "banned",
			label: "Banned",
			count: users.filter((u) => u.isBanned).length,
		},
	];

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
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input
						placeholder="Search users..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9 h-9 rounded-xl text-sm"
					/>
				</div>
				<div className="grid grid-cols-3 sm:flex gap-1 rounded-xl border bg-muted/40 p-1 shrink-0 w-full sm:w-auto">
					{filterTabs.map((ft) => (
						<button
							key={ft.id}
							type="button"
							onClick={() => setFilterTab(ft.id)}
							className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
								filterTab === ft.id
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{ft.label}
							<span
								className={`text-[10px] rounded-full px-1.5 py-0.5 ${
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
								filteredUsers.map((user) => {
									const currentRoles = (user.roles ?? []).filter(
										(role) =>
											role === "video-player" || role === "ai-integrations",
									) as DynamicRbacRole[];

									const isSelf =
										currentUser?.id === user.tokenIdentifier ||
										`clerk|${currentUser?.id}` === user.tokenIdentifier;
									const isBanned = user.isBanned;

									return (
										<tr
											key={user._id}
											className={`border-b last:border-0 transition-colors ${
												isBanned ? "bg-destructive/5" : "hover:bg-muted/20"
											}`}
										>
											<td className="px-4 py-3.5">
												<div className="flex items-center gap-3">
													{user.image ? (
														<img
															src={user.image}
															alt={user.name}
															className="size-8 rounded-full object-cover ring-1 ring-border"
														/>
													) : (
														<div className="flex size-8 items-center justify-center rounded-full bg-secondary ring-1 ring-border">
															<UserCog className="size-4 text-muted-foreground" />
														</div>
													)}
													<div>
														<div className="flex items-center gap-2">
															<span className="font-medium">{user.name}</span>
															{user.isAdmin && (
																<Badge
																	variant="outline"
																	className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px] px-1.5 py-0"
																>
																	Admin
																</Badge>
															)}
															{isSelf && (
																<Badge
																	variant="outline"
																	className="border-border text-muted-foreground text-[10px] px-1.5 py-0"
																>
																	You
																</Badge>
															)}
														</div>
														<p className="text-xs text-muted-foreground">
															{user.email}
														</p>
													</div>
												</div>
											</td>
											<td className="px-4 py-3.5">
												{isBanned ? (
													<Badge className="gap-1 bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20 font-semibold">
														<UserX className="size-3" />
														Banned
													</Badge>
												) : (
													<Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 font-semibold">
														<ShieldCheck className="size-3" />
														Active
													</Badge>
												)}
											</td>
											<td className="px-4 py-3.5">
												<div className="flex items-center gap-1 flex-wrap">
													{ROLE_CONFIGS.map((config) => {
														const isActive = currentRoles.includes(
															config.value,
														);

														const toggleRole = () => {
															setRoleError(null);
															const next = isActive
																? currentRoles.filter((r) => r !== config.value)
																: [...currentRoles, config.value];
															setUserRoles({
																tokenIdentifier: user.tokenIdentifier,
																roles: next,
															}).catch((err) => {
																setRoleError(
																	err instanceof Error
																		? err.message
																		: String(err),
																);
															});
														};

														return (
															<button
																key={config.value}
																type="button"
																onClick={toggleRole}
																disabled={isBanned}
																title={
																	isActive
																		? `Remove ${config.label}`
																		: `Grant ${config.label}`
																}
																className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
																	isActive
																		? "bg-secondary text-foreground border-border shadow-xs"
																		: "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground"
																}`}
															>
																{isActive && <Check className="size-3" />}
																{config.short}
															</button>
														);
													})}
												</div>
											</td>
											<td className="px-4 py-3.5 text-right">
												<Button
													variant={isBanned ? "outline" : "destructive"}
													size="sm"
													className={`h-8 px-3 text-xs font-semibold ${
														isBanned
															? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
															: ""
													}`}
													onClick={() => {
														setErrorMessage(null);
														setSelectedUser({
															tokenIdentifier: user.tokenIdentifier,
															name: user.name,
															email: user.email,
															isBanned: user.isBanned,
														});
													}}
													disabled={isSelf || user.isAdmin}
													title={
														isSelf
															? "You cannot ban yourself"
															: user.isAdmin
																? "Admin users cannot be banned"
																: isBanned
																	? "Unban User"
																	: "Ban User"
													}
												>
													{isBanned ? (
														<>
															<ShieldCheck className="mr-1.5 size-3" />
															Unban
														</>
													) : (
														<>
															<Ban className="mr-1.5 size-3" />
															Ban
														</>
													)}
												</Button>
											</td>
										</tr>
									);
								})
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
					filteredUsers.map((user) => {
						const currentRoles = (user.roles ?? []).filter(
							(role) => role === "video-player" || role === "ai-integrations",
						) as DynamicRbacRole[];

						const isSelf =
							currentUser?.id === user.tokenIdentifier ||
							`clerk|${currentUser?.id}` === user.tokenIdentifier;
						const isBanned = user.isBanned;

						return (
							<div
								key={user._id}
								className={`rounded-2xl border p-4 transition-all ${
									isBanned
										? "bg-destructive/5 border-destructive/20"
										: "bg-card/90 border-border/60 shadow-xs"
								}`}
							>
								{/* Header Row: User Info + Status Badge */}
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-center gap-3 min-w-0 flex-1">
										{user.image ? (
											<img
												src={user.image}
												alt={user.name}
												className="size-11 rounded-full object-cover shrink-0 ring-1 ring-border/60"
											/>
										) : (
											<div className="flex size-11 items-center justify-center rounded-full bg-secondary shrink-0 ring-1 ring-border/60">
												<UserCog className="size-5 text-muted-foreground" />
											</div>
										)}
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-1.5 flex-wrap">
												<span className="font-bold text-sm text-foreground truncate">
													{user.name}
												</span>
												{user.isAdmin && (
													<Badge
														variant="outline"
														className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px] px-1.5 py-0 shrink-0 font-semibold"
													>
														Admin
													</Badge>
												)}
												{isSelf && (
													<Badge
														variant="outline"
														className="border-border text-muted-foreground text-[10px] px-1.5 py-0 shrink-0 font-semibold"
													>
														You
													</Badge>
												)}
											</div>
											<p className="text-xs text-muted-foreground truncate mt-0.5">
												{user.email}
											</p>
										</div>
									</div>

									{/* Status Badge */}
									{isBanned ? (
										<Badge className="gap-1 bg-destructive/15 text-destructive border-destructive/30 font-semibold text-xs py-1 shrink-0">
											<UserX className="size-3" />
											Banned
										</Badge>
									) : (
										<Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold text-xs py-1 shrink-0">
											<ShieldCheck className="size-3" />
											Active
										</Badge>
									)}
								</div>

								{/* Bottom Section: Labeled Feature Roles + Quick Actions */}
								<div className="mt-3.5 pt-3 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
									<div className="flex items-center gap-1.5 flex-wrap">
										<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-0.5">
											Roles:
										</span>
										{ROLE_CONFIGS.map((config) => {
											const isActive = currentRoles.includes(config.value);
											const toggleRole = () => {
												setRoleError(null);
												const next = isActive
													? currentRoles.filter((r) => r !== config.value)
													: [...currentRoles, config.value];
												setUserRoles({
													tokenIdentifier: user.tokenIdentifier,
													roles: next,
												}).catch((err) => {
													setRoleError(
														err instanceof Error ? err.message : String(err),
													);
												});
											};

											return (
												<button
													key={config.value}
													type="button"
													onClick={toggleRole}
													disabled={isBanned}
													className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold border transition-all duration-150 min-h-[36px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
														isActive
															? "bg-secondary text-foreground border-border/80 shadow-xs"
															: "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground"
													}`}
												>
													{isActive && <Check className="size-3.5" />}
													{config.label}
												</button>
											);
										})}
									</div>

									{!isSelf && !user.isAdmin && (
										<Button
											variant={isBanned ? "outline" : "destructive"}
											size="sm"
											className={`h-9 px-3.5 text-xs font-semibold rounded-xl ml-auto min-h-[36px] ${
												isBanned
													? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
													: ""
											}`}
											onClick={() => {
												setErrorMessage(null);
												setSelectedUser({
													tokenIdentifier: user.tokenIdentifier,
													name: user.name,
													email: user.email,
													isBanned: user.isBanned,
												});
											}}
										>
											{isBanned ? (
												<>
													<ShieldCheck className="mr-1 size-3.5" />
													Unban
												</>
											) : (
												<>
													<Ban className="mr-1 size-3.5" />
													Ban
												</>
											)}
										</Button>
									)}
								</div>
							</div>
						);
					})
				)}
			</div>

			{filteredUsers.length > 0 && (
				<p className="text-xs text-muted-foreground text-center pt-2 pb-6">
					Showing {filteredUsers.length} of {users.length} users
				</p>
			)}

			{/* Ban / Unban Confirmation Dialog */}
			<Dialog
				open={selectedUser !== null}
				onOpenChange={(open) => {
					if (!open && !isSubmitting) {
						setSelectedUser(null);
						setErrorMessage(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-[420px] p-6">
					<DialogHeader className="space-y-2">
						<div className="flex items-center gap-3">
							{selectedUser?.isBanned ? (
								<div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
									<ShieldCheck className="size-5" />
								</div>
							) : (
								<div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0">
									<Ban className="size-5" />
								</div>
							)}
							<DialogTitle className="text-lg font-bold">
								{selectedUser?.isBanned ? "Unban User" : "Ban User"}
							</DialogTitle>
						</div>
						<DialogDescription className="text-sm leading-relaxed text-muted-foreground">
							{selectedUser?.isBanned ? (
								<>
									Are you sure you want to unban{" "}
									<span className="font-semibold text-foreground">
										{selectedUser?.name}
									</span>{" "}
									({selectedUser?.email})? They will regain access to
									application features according to their assigned roles.
								</>
							) : (
								<>
									Are you sure you want to ban{" "}
									<span className="font-semibold text-foreground">
										{selectedUser?.name}
									</span>{" "}
									({selectedUser?.email})? They will be immediately blocked from
									accessing application features.
								</>
							)}
						</DialogDescription>
					</DialogHeader>

					{errorMessage && (
						<div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
							<AlertCircle className="size-4 shrink-0" />
							<span>{errorMessage}</span>
						</div>
					)}

					<DialogFooter className="mt-4 gap-2 sm:gap-2 flex-col sm:flex-row">
						<DialogClose asChild>
							<Button
								variant="outline"
								type="button"
								disabled={isSubmitting}
								className="flex-1"
							>
								Cancel
							</Button>
						</DialogClose>
						<Button
							variant={selectedUser?.isBanned ? "default" : "destructive"}
							type="button"
							onClick={handleConfirmBanToggle}
							disabled={isSubmitting}
							className={`flex-1 ${
								selectedUser?.isBanned
									? "bg-emerald-600 hover:bg-emerald-700 text-white"
									: ""
							}`}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Processing...
								</>
							) : selectedUser?.isBanned ? (
								<>
									<ShieldCheck className="mr-1.5 size-4" />
									Confirm Unban
								</>
							) : (
								<>
									<Ban className="mr-1.5 size-4" />
									Confirm Ban
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
