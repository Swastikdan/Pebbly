import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [showPrompt, setShowPrompt] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		const handler = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);

			const dismissedStorage = localStorage.getItem("pwa-prompt-dismissed");
			if (!dismissedStorage) {
				setTimeout(() => setShowPrompt(true), 3000);
			}
		};

		window.addEventListener("beforeinstallprompt", handler);
		return () => window.removeEventListener("beforeinstallprompt", handler);
	}, []);

	useEffect(() => {
		if (window.matchMedia("(display-mode: standalone)").matches) {
			setShowPrompt(false);
		}
	}, []);

	const handleInstall = useCallback(async () => {
		if (!deferredPrompt) return;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === "accepted") {
			setShowPrompt(false);
		}
		setDeferredPrompt(null);
	}, [deferredPrompt]);

	const handleDismiss = useCallback(() => {
		setShowPrompt(false);
		setDismissed(true);
		localStorage.setItem("pwa-prompt-dismissed", "true");
	}, []);

	if (!showPrompt || dismissed) return null;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
			<div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
				<div className="flex-1">
					<p className="text-sm font-semibold text-foreground">
						Install Pebbly
					</p>
					<p className="text-xs text-muted-foreground">
						Add to Home Screen for the best experience
					</p>
				</div>
				<button
					type="button"
					onClick={handleInstall}
					className="pressable rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
				>
					Install
				</button>
				<button
					type="button"
					onClick={handleDismiss}
					className="text-muted-foreground hover:text-foreground"
				>
					<X className="size-4" />
				</button>
			</div>
		</div>
	);
}
