/**
 * Theme provider with system/light/dark mode support.
 * Based on shadcn/ui dark-mode pattern and next-themes.
 */
import { ScriptOnce } from "@tanstack/react-router";
import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

type Theme = "dark" | "light" | "system";
const MEDIA = "(prefers-color-scheme: dark)";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
	theme: "system",
	setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const disableTransitions = () => {
	const style = document.createElement("style");
	style.appendChild(
		document.createTextNode(
			"*,*::before,*::after{transition-property:none !important;animation:none !important}",
		),
	);
	document.head.appendChild(style);

	return () => {
		window.getComputedStyle(document.body);
		requestAnimationFrame(() => {
			if (style.parentNode) {
				style.parentNode.removeChild(style);
			}
		});
	};
};

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "theme",
	...props
}: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>(
		() =>
			(typeof window !== "undefined"
				? (localStorage.getItem(storageKey) as Theme)
				: null) || defaultTheme,
	);

	const handleMediaQuery = useCallback(
		(e: MediaQueryListEvent | MediaQueryList) => {
			if (theme !== "system") return;
			const root = window.document.documentElement;
			const targetTheme = e.matches ? "dark" : "light";
			if (!root.classList.contains(targetTheme)) {
				const restoreTransitions = disableTransitions();
				root.classList.remove("light", "dark");
				root.classList.add(targetTheme);
				restoreTransitions();
			}
		},
		[theme],
	);

	useEffect(() => {
		const media = window.matchMedia(MEDIA);

		media.addEventListener("change", handleMediaQuery);
		handleMediaQuery(media);

		return () => media.removeEventListener("change", handleMediaQuery);
	}, [handleMediaQuery]);

	useEffect(() => {
		const root = window.document.documentElement;

		let targetTheme: string;

		if (theme === "system") {
			localStorage.removeItem(storageKey);
			targetTheme = window.matchMedia(MEDIA).matches ? "dark" : "light";
		} else {
			localStorage.setItem(storageKey, theme);
			targetTheme = theme;
		}

		if (!root.classList.contains(targetTheme)) {
			const restoreTransitions = disableTransitions();
			root.classList.remove("light", "dark");
			root.classList.add(targetTheme);
			restoreTransitions();
		}
	}, [theme, storageKey]);

	const value = useMemo(
		() => ({
			theme,
			setTheme,
		}),
		[theme],
	);

	return (
		<ThemeProviderContext {...props} value={value}>
			<ScriptOnce>
				{/* Prevents flash of wrong theme on initial load */}
				{`document.documentElement.classList.toggle(
            'dark',
            localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
            )`}
			</ScriptOnce>
			{children}
		</ThemeProviderContext>
	);
}

export const useTheme = () => {
	const context = use(ThemeProviderContext);

	if (context === undefined)
		throw new Error("useTheme must be used within a ThemeProvider");

	return context;
};
