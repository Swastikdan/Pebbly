"use client";
import { useLocation } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "./theme-switch";
import { BookMarkFilledIcon, SearchFilledIcon } from "@/components/ui/icons";

const DesktopNavButton = ({
	href,
	label,
	icon,
	className,
}: {
	href: string;
	label: string;
	icon: React.ReactNode;
	className?: string;
}) => {
	const location = useLocation();
	const isActive = location.pathname === href;
	return (
		<Link
			to={href}
			aria-label={label}
			className="cursor-pointer rounded-[calc(var(--radius-md)+3px)] pressable"
		>
			<Button
				variant={isActive ? "secondary" : "outline"}
				size="icon"
				className={cn(className, "rounded-[calc(var(--radius-md)+3px)]")}
				aria-label={label}
			>
				{icon}
			</Button>
		</Link>
	);
};

DesktopNavButton.displayName = "DesktopNavButton";

const DesktopNavButtons = () => {
	return (
		<>
			<DesktopNavButton
				href="/watchlist"
				label="Watchlist"
				icon={<BookMarkFilledIcon />}
			/>
			<DesktopNavButton
				href="/search"
				label="Search"
				icon={<SearchFilledIcon />}
			/>
			<ThemeSwitch />
		</>
	);
};

DesktopNavButtons.displayName = "DesktopNavButtons";

export { DesktopNavButtons };
