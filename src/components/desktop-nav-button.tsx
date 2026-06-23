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
	SparklesFilledIcon,
	UserIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
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
		<Button
			variant={isActive ? "secondary" : "outline"}
			size="icon"
			className={cn(className, "rounded-full pressable")}
			asChild
		>
			<Link to={href} aria-label={label} className="cursor-pointer">
				{icon}
			</Link>
		</Button>
	);
};

DesktopNavButton.displayName = "DesktopNavButton";

const DesktopNavButtons = () => {
	const { hasFeature } = usePermissions();

	return (
		<>
			{hasFeature("ai-recommendations") && (
				<DesktopNavButton
					href="/recommendations"
					label="AI Recommendations"
					className="hidden sm:flex"
					icon={<SparklesFilledIcon className="size-5" />}
				/>
			)}
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
				<Skeleton className="size-9 rounded-full" />
			</ClerkLoading>
			<ClerkLoaded>
				<SignedOut>
					<SignInButton mode="modal">
						<Button
							variant="outline"
							className="rounded-full size-9 flex items-center justify-center  p-0"
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
										"!size-9 !rounded-full !border-2 !border-secondary",
									userButtonTrigger: "!h-9 !w-9 !rounded-full",
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
