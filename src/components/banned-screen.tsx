import { useClerk } from "@clerk/react";
import { Ban, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BannedScreen() {
	const { signOut } = useClerk();

	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
			<div className="w-full max-w-sm space-y-6 text-center">
				<div className="flex justify-center">
					<div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
						<Ban className="size-8" />
					</div>
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-bold tracking-tight">
						Account Suspended
					</h1>
					<p className="text-sm text-muted-foreground leading-relaxed">
						Your account has been suspended and you no longer have access to
						this application. If you believe this is a mistake, please contact
						support.
					</p>
				</div>

				<Button
					variant="outline"
					className="w-full gap-2"
					onClick={() => signOut()}
				>
					<LogOut className="size-4" />
					Sign Out
				</Button>
			</div>
		</div>
	);
}
