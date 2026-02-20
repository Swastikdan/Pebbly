import {
	ClerkLoaded,
	ClerkLoading,
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
} from "@clerk/clerk-react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
	BookMarkFilledIcon,
	SearchFilledIcon,
	UserIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ThemeSwitch } from "./theme-switch";

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
			<ClerkLoading>
				<Skeleton className="size-9 rounded-lg" />
			</ClerkLoading>
			<ClerkLoaded>
				<SignedOut>
					<SignInButton mode="modal">
						<Button
							variant="outline"
							className="rounded-lg size-9 flex items-center justify-center  p-0"
						>
							<UserIcon className="size-5" />
						</Button>
					</SignInButton>
				</SignedOut>
				<SignedIn>
					<div className="flex size-10 items-center justify-center">
						<UserButton
							appearance={{
								elements: {
									userButtonAvatarBox:
										"!size-9 !rounded-lg !border-2 !border-secondary",
									userButtonTrigger: "!h-9 !w-9 !rounded-lg",
								},
							}}
						/>
					</div>
				</SignedIn>
			</ClerkLoaded>
		</>
	);
};

DesktopNavButtons.displayName = "DesktopNavButtons";

export { DesktopNavButtons };
