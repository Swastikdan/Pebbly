import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface NavigationProgressBarProps {
	/** Minimum loading duration (in ms) before the bar appears. Default is 200ms. */
	delay?: number;
}

export function NavigationProgressBar({
	delay = 200,
}: NavigationProgressBarProps) {
	const isLoading = useRouterState({
		select: (s) => s.status === "pending",
	});
	const [visible, setVisible] = useState(false);
	const [progress, setProgress] = useState(0);

	const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (isLoading) {
			// Clear any lingering exit timer from a rapid re-navigation
			if (finishTimerRef.current) {
				clearTimeout(finishTimerRef.current);
				finishTimerRef.current = null;
			}

			// Wait for the delay threshold before rendering anything
			delayTimerRef.current = setTimeout(() => {
				setVisible(true);
				setProgress(20);

				if (timerRef.current) clearInterval(timerRef.current);

				timerRef.current = setInterval(() => {
					setProgress((prev) => {
						if (prev < 60) return prev + 15;
						if (prev < 80) return prev + 5;
						if (prev < 92) return prev + 1.5;
						return prev;
					});
				}, 150);
			}, delay);
		} else {
			// Fast route: cancel pending start if route resolved within the delay window
			if (delayTimerRef.current) {
				clearTimeout(delayTimerRef.current);
				delayTimerRef.current = null;
			}

			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}

			// Only complete and fade out if the bar actually became visible
			if (visible) {
				setProgress(100);
				finishTimerRef.current = setTimeout(() => {
					setVisible(false);
					setProgress(0);
				}, 250);
			}
		}

		return () => {
			if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
			if (timerRef.current) clearInterval(timerRef.current);
			if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
		};
	}, [isLoading, visible, delay]);

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
