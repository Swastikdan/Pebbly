import { AlertCircle, Ban, Loader2, ShieldCheck } from "lucide-react";
import type { UserTarget } from "@/components/admin/use-admin-users";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPopup,
	DialogTitle,
} from "@/components/ui/dialog";

export function AdminRoleDialog({
	selectedUser,
	isSubmitting,
	errorMessage,
	onConfirm,
	onOpenChange,
}: {
	selectedUser: UserTarget | null;
	isSubmitting: boolean;
	errorMessage: string | null;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={selectedUser !== null} onOpenChange={onOpenChange}>
			<DialogPopup className="sm:max-w-[420px] p-6">
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
								({selectedUser?.email})? They will regain access to application
								features according to their assigned roles.
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
					<DialogClose
						render={
							<Button
								variant="outline"
								type="button"
								disabled={isSubmitting}
								className="flex-1"
							/>
						}
					>
						Cancel
					</DialogClose>
					<Button
						variant={selectedUser?.isBanned ? "default" : "destructive"}
						type="button"
						onClick={onConfirm}
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
			</DialogPopup>
		</Dialog>
	);
}
