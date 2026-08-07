import { useEffect, useState } from "react";
import { SITE_CONFIG } from "@/constants";

export function PWASplashScreen() {
	const [isVisible, setIsVisible] = useState(false);
	const [isFadingOut, setIsFadingOut] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const isStandalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			// @ts-expect-error - iOS Safari standalone check
			window.navigator.standalone === true;

		const alreadyShown = sessionStorage.getItem("pebbly_pwa_splash_shown");

		if (isStandalone && !alreadyShown) {
			setIsVisible(true);
			sessionStorage.setItem("pebbly_pwa_splash_shown", "true");

			const timer = setTimeout(() => {
				setIsFadingOut(true);
				const removeTimer = setTimeout(() => {
					setIsVisible(false);
				}, 400);
				return () => clearTimeout(removeTimer);
			}, 1400);

			return () => clearTimeout(timer);
		}
	}, []);

	if (!isVisible) return null;

	return (
		<div
			aria-hidden="true"
			className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0b0a08] transition-opacity duration-400 ease-out ${
				isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
			}`}
		>
			{/* Ambient background glow */}
			<div className="absolute size-64 rounded-full bg-gradient-to-tr from-cyan-500/15 to-purple-500/15 blur-3xl animate-pulse" />

			{/* Logo & Content */}
			<div className="relative flex flex-col items-center gap-4 text-center px-6">
				<div className="relative flex size-20 items-center justify-center rounded-3xl bg-secondary/80 border border-white/10 shadow-2xl backdrop-blur-xl">
					<img
						src="/logo.svg"
						alt={SITE_CONFIG.name}
						className="size-12 object-contain drop-shadow-md animate-pulse"
					/>
				</div>

				<div className="space-y-1">
					<h1 className="font-extrabold text-2xl tracking-tight text-foreground font-heading">
						{SITE_CONFIG.name}
					</h1>
					<p className="text-xs font-medium text-muted-foreground tracking-wide">
						Movies & TV Shows
					</p>
				</div>

				{/* Loading dots */}
				<div className="mt-4 flex items-center gap-1.5">
					<span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
					<span className="size-2 rounded-full bg-purple-500 animate-pulse delay-150" />
					<span className="size-2 rounded-full bg-indigo-500 animate-pulse delay-300" />
				</div>
			</div>
		</div>
	);
}
