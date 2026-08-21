import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { type Toast, useToastStore } from "@/hooks/use-toast-store";
import { cn } from "@/lib/utils";

const TOAST_DURATION = 5000;

function ToastItem({
	toast,
	onDismiss,
}: {
	toast: Toast;
	onDismiss: (id: string) => void;
}) {
	const timeoutRef = useRef<number | null>(null);
	const startedAtRef = useRef(Date.now());

	useEffect(() => {
		const schedule = () => {
			if (document.hidden) return; // pause while the tab is hidden
			const elapsed = Date.now() - startedAtRef.current;
			const left = TOAST_DURATION - elapsed;
			if (left <= 0) {
				onDismiss(toast.id);
				return;
			}
			if (timeoutRef.current !== null) {
				window.clearTimeout(timeoutRef.current);
			}
			timeoutRef.current = window.setTimeout(() => {
				if (document.hidden) return; // visibilitychange will reschedule
				onDismiss(toast.id);
			}, left);
		};

		schedule();
		const onVisible = () => schedule();
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			if (timeoutRef.current !== null) {
				window.clearTimeout(timeoutRef.current);
			}
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [toast.id, onDismiss]);

	return (
		<div
			role="status"
			className={cn(
				"pointer-events-auto flex w-full items-center gap-3 overflow-hidden rounded-full border border-white/10 bg-[color-mix(in_oklab,var(--surface-2)_94%,transparent)] py-2.5 pl-4 pr-2 shadow-[0_8px_30px_rgb(0_0_0/0.35)] backdrop-blur-xl",
				"transition-[transform,opacity] duration-200 ease-out",
				toast.leaving
					? "-translate-y-2 opacity-0"
					: "translate-y-0 opacity-100",
			)}
		>
			<span
				className="size-2 shrink-0 self-center rounded-full bg-primary shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
				aria-hidden="true"
			/>
			<div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
				<p className="truncate text-sm font-semibold leading-tight text-foreground">
					{toast.title}
				</p>
				{toast.description && (
					<p className="truncate text-xs leading-snug text-muted-foreground">
						{toast.description}
					</p>
				)}
			</div>
			{toast.action && (
				<Button
					type="button"
					variant="ghost"
					onClick={() => {
						toast.action?.onClick();
						onDismiss(toast.id);
					}}
					className="h-7 shrink-0 self-center rounded-full px-3 text-xs font-bold text-primary hover:bg-white/5 hover:text-primary/80"
				>
					{toast.action.label}
				</Button>
			)}
			<button
				type="button"
				onClick={() => onDismiss(toast.id)}
				aria-label="Dismiss notification"
				className="grid size-7 shrink-0 self-center place-items-center rounded-full text-muted-foreground/50 transition-colors hover:bg-white/5 hover:text-foreground"
			>
				<svg
					className="size-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
					strokeLinecap="round"
				>
					<title>Dismiss</title>
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	);
}

export function Toaster() {
	const toasts = useToastStore((state) => state.toasts);
	const dismiss = useToastStore((state) => state.dismiss);

	return (
		<div
			aria-live="polite"
			aria-atomic="false"
			className="pointer-events-none fixed inset-x-4 bottom-20 z-[70] flex flex-col items-stretch gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-96 md:items-end"
		>
			{toasts.map((t) => (
				<ToastItem key={t.id} toast={t} onDismiss={dismiss} />
			))}
		</div>
	);
}
