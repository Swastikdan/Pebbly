import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function NavigationProgressBar() {
	const isLoading = useRouterState({
		select: (s) => s.status === "pending",
	});
	const [visible, setVisible] = useState(false);
	const [progress, setProgress] = useState(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (isLoading) {
			if (finishTimerRef.current) {
				clearTimeout(finishTimerRef.current);
				finishTimerRef.current = null;
			}
			setVisible(true);
			setProgress(20);

			if (timerRef.current) {
				clearInterval(timerRef.current);
			}

			// Smooth progressive advance while loading
			timerRef.current = setInterval(() => {
				setProgress((prev) => {
					if (prev < 60) return prev + 15;
					if (prev < 80) return prev + 5;
					if (prev < 92) return prev + 1.5;
					return prev;
				});
			}, 150);
		} else {
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}

			if (visible) {
				setProgress(100);
				finishTimerRef.current = setTimeout(() => {
					setVisible(false);
					setProgress(0);
				}, 250);
			}
		}

		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
		};
	}, [isLoading, visible]);

	if (!visible && progress === 0) {
		return null;
	}

	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] transition-opacity duration-200",
				visible ? "opacity-100" : "opacity-0",
			)}
		>
			<div
				className="h-full bg-gradient-to-r from-blue-500 via-primary to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.7)] transition-all duration-200 ease-out"
				style={{
					width: `${progress}%`,
				}}
			/>
		</div>
	);
}
