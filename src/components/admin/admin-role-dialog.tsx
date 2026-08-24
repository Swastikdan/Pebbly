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
import { ErrorBanner } from "@/components/ui/feedback";

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
      <DialogPopup className="p-6 sm:max-w-[420px]">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            {selectedUser?.isBanned ? (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="size-5" />
              </div>
            ) : (
              <div className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Ban className="size-5" />
              </div>
            )}
            <DialogTitle className="text-lg font-bold">
              {selectedUser?.isBanned ? "Unban User" : "Ban User"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {selectedUser?.isBanned ? (
              <>
                Are you sure you want to unban{" "}
                <span className="text-foreground font-semibold">
                  {selectedUser?.name}
                </span>{" "}
                ({selectedUser?.email})? They will regain access to application
                features according to their assigned roles.
              </>
            ) : (
              <>
                Are you sure you want to ban{" "}
                <span className="text-foreground font-semibold">
                  {selectedUser?.name}
                </span>{" "}
                ({selectedUser?.email})? They will be immediately blocked from
                accessing application features.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <ErrorBanner className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </ErrorBanner>
        )}

        <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row sm:gap-2">
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
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
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
