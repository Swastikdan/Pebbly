import { useUser } from "@clerk/react";
import { useMutation, useQuery } from "convex/react";
import {
	AlertCircle,
	Ban,
	Check,
	Loader2,
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

interface UserTarget {
	tokenIdentifier: string;
	name: string;
	email: string;
	isBanned: boolean;
}

export function AdminUserTable() {
	const { user: currentUser } = useUser();
	const users = useQuery(api.admin.listUsers, {});
	const setUserRoles = useMutation(api.admin.setUserRoles);
	const setUserBanned = useMutation(api.admin.setUserBanned);

	// Confirmation Dialog state
	const [selectedUser, setSelectedUser] = useState<UserTarget | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [roleError, setRoleError] = useState<string | null>(null);

	if (users === undefined) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-10 w-full rounded-lg" />
				<Skeleton className="h-10 w-full rounded-lg" />
				<Skeleton className="h-10 w-full rounded-lg" />
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

			<div className="rounded-xl border">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="px-4 py-3 text-left font-semibold">User</th>
								<th className="px-4 py-3 text-left font-semibold">Email</th>
								<th className="px-4 py-3 text-left font-semibold">Status</th>
								<th className="px-4 py-3 text-left font-semibold">Roles</th>
								<th className="px-4 py-3 text-right font-semibold">Actions</th>
							</tr>
						</thead>
						<tbody>
							{users.map((user) => {
								const currentRoles = (user.roles ?? []).filter(
									(role) =>
										role === "video-player" || role === "ai-integrations",
								) as DynamicRbacRole[];

								const isSelf = currentUser?.id === user.tokenIdentifier;
								const isBanned = user.isBanned;

								return (
									<tr
										key={user._id}
										className={`border-b last:border-0 hover:bg-muted/30 ${
											isBanned ? "bg-destructive/5 opacity-85" : ""
										}`}
									>
										<td className="px-4 py-3">
											<div className="flex items-center gap-3">
												{user.image ? (
													<img
														src={user.image}
														alt={user.name}
														className="size-8 rounded-full object-cover"
													/>
												) : (
													<div className="flex size-8 items-center justify-center rounded-full bg-secondary">
														<UserCog className="size-4 text-muted-foreground" />
													</div>
												)}
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
												</div>
											</div>
										</td>
										<td className="px-4 py-3 text-muted-foreground">
											{user.email}
										</td>
										<td className="px-4 py-3">
											{isBanned ? (
												<Badge
													variant="destructive"
													className="gap-1 bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20 font-semibold"
												>
													<UserX className="size-3" />
													Banned
												</Badge>
											) : (
												<Badge
													variant="outline"
													className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 font-semibold"
												>
													<ShieldCheck className="size-3" />
													Active
												</Badge>
											)}
										</td>
										<td className="px-4 py-3">
											<RoleBadge roles={currentRoles} />
										</td>
										<td className="px-4 py-3 text-right">
											<div className="flex items-center justify-end gap-1.5">
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
																err instanceof Error
																	? err.message
																	: String(err),
															);
														});
													};

													return (
														<Button
															key={config.value}
															variant={isActive ? "secondary" : "outline"}
															size="sm"
															className="h-7 px-2.5 text-xs"
															onClick={toggleRole}
															disabled={isBanned}
														>
															{isActive && <Check className="mr-1 size-3" />}
															{config.label}
														</Button>
													);
												})}

												<Button
													variant={isBanned ? "outline" : "destructive"}
													size="sm"
													className="h-7 px-2.5 text-xs font-semibold"
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
															<ShieldCheck className="mr-1 size-3" />
															Unban
														</>
													) : (
														<>
															<Ban className="mr-1 size-3" />
															Ban
														</>
													)}
												</Button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

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
						<div className="flex items-center gap-2">
							{selectedUser?.isBanned ? (
								<div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
									<ShieldCheck className="size-5" />
								</div>
							) : (
								<div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
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

					<DialogFooter className="mt-4 gap-2 sm:gap-0">
						<DialogClose asChild>
							<Button variant="outline" type="button" disabled={isSubmitting}>
								Cancel
							</Button>
						</DialogClose>
						<Button
							variant={selectedUser?.isBanned ? "default" : "destructive"}
							type="button"
							onClick={handleConfirmBanToggle}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Processing...
								</>
							) : selectedUser?.isBanned ? (
								"Confirm Unban"
							) : (
								"Confirm Ban"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
