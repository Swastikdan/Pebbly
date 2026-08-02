import {
	ClerkLoaded,
	ClerkLoading,
	Show,
	SignInButton,
	UserButton,
} from "@clerk/react";
import { Link, useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	BookMarkFilledIcon,
	BookMarkIcon,
	HomeFilledIcon,
	HomeIcon,
	MenuIcon,
	SearchFilledIcon,
	SearchIcon,
	UserIcon,
} from "@/components/ui/icons";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_ITEMS } from "@/constants";

const MobileNavSubmenuItems = ({
	items,
}: {
	items: { name: string; url: string; slug: string }[];
}) => {
	return (
		<>
			{items.map((subitem) => (
				<SheetClose asChild key={subitem.slug}>
					<Button
						variant="outline"
						className="h-9 w-full justify-start text-sm"
						asChild
					>
						<Link to={subitem.url} className="w-full pl-3 cursor-pointer">
							{subitem.name}
						</Link>
					</Button>
				</SheetClose>
			))}
		</>
	);
};

const MobileNavMenuItem = ({
	item,
}: {
	item: {
		name: string;
		slug: string;
		submenu: { name: string; url: string; slug: string }[];
	};
}) => {
	return (
		<div className="flex flex-col items-start justify-start gap-1.5">
			<Button
				variant="secondary"
				className="w-full justify-start font-bold text-sm h-9"
			>
				{item.name}
			</Button>
			<MobileNavSubmenuItems items={item.submenu} />
		</div>
	);
};

interface TabItem {
	href: string;
	label: string;
	icon: React.ReactNode;
	activeIcon: React.ReactNode;
	matchExact?: boolean;
}

function useScrollDirection() {
	const [hidden, setHidden] = useState(false);
	const lastScrollY = useRef(0);
	const ticking = useRef(false);

	const update = useCallback(() => {
		const currentScrollY = window.scrollY;
		const delta = currentScrollY - lastScrollY.current;

		// Only react to meaningful scroll (> 8px) to avoid jitter
		if (Math.abs(delta) > 8) {
			// Scrolling down → hide, scrolling up → show
			setHidden(delta > 0 && currentScrollY > 60);
		}

		// Always show at the very top
		if (currentScrollY <= 10) {
			setHidden(false);
		}

		lastScrollY.current = currentScrollY;
		ticking.current = false;
	}, []);

	useEffect(() => {
		const onScroll = () => {
			if (!ticking.current) {
				ticking.current = true;
				requestAnimationFrame(update);
			}
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [update]);

	return hidden;
}

const MobileBottomNav = () => {
	const location = useLocation();
	const isHidden = useScrollDirection();

	const tabs: TabItem[] = [
		{
			href: "/",
			label: "Home",
			icon: <HomeIcon className="size-[22px]" />,
			activeIcon: <HomeFilledIcon className="size-[22px]" />,
			matchExact: true,
		},
		{
			href: "/search",
			label: "Search",
			icon: <SearchIcon className="size-[22px]" />,
			activeIcon: <SearchFilledIcon className="size-[22px]" />,
		},
		{
			href: "/watchlist",
			label: "Watchlist",
			icon: <BookMarkIcon className="size-[22px]" />,
			activeIcon: <BookMarkFilledIcon className="size-[22px]" />,
		},
	];

	const isTabActive = (tab: TabItem) => {
		if (tab.matchExact) {
			return location.pathname === tab.href;
		}
		return location.pathname.startsWith(tab.href);
	};

	return (
		<nav
			className={`mobile-bottom-nav md:hidden ${isHidden ? "mobile-bottom-nav-hidden" : ""}`}
			aria-label="Mobile Navigation"
		>
			{tabs.map((tab) => {
				const active = isTabActive(tab);
				return (
					<Link
						key={tab.href}
						to={tab.href}
						className="mobile-bottom-nav-tab"
						data-active={active}
						aria-label={tab.label}
						aria-current={active ? "page" : undefined}
					>
						<span className="mobile-bottom-nav-tab-icon">
							{active ? tab.activeIcon : tab.icon}
						</span>
						<span className="mobile-bottom-nav-tab-label">{tab.label}</span>
					</Link>
				);
			})}

			{/* Menu tab opens the Sheet drawer */}
			<Sheet>
				<SheetTrigger asChild>
					<button
						type="button"
						className="mobile-bottom-nav-tab"
						data-active="false"
						aria-label="Menu"
					>
						<span className="mobile-bottom-nav-tab-icon">
							<MenuIcon className="size-[22px]" />
						</span>
						<span className="mobile-bottom-nav-tab-label">Menu</span>
					</button>
				</SheetTrigger>
				<SheetContent
					className="border-none px-3 duration-0"
					aria-label="Mobile Navigation Menu"
				>
					<SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
					<div className="scrollbar-small flex h-full flex-col gap-4 overflow-y-auto py-12 pt-20">
						{NAV_ITEMS.map((item) => (
							<MobileNavMenuItem key={item.slug} item={item} />
						))}
					</div>
				</SheetContent>
			</Sheet>

			{/* User account tab — always shows UserIcon as base, Clerk layers on top */}
			<div className="mobile-bottom-nav-tab" data-active="false">
				<div className="mobile-bottom-nav-tab-icon mobile-bottom-nav-account">
					{/* Base fallback icon — always visible until Clerk renders */}
					<ClerkLoading>
						<UserIcon className="size-[22px]" />
					</ClerkLoading>
					<ClerkLoaded>
						<Show when="signed-out">
							<SignInButton mode="modal">
								<button
									type="button"
									aria-label="Sign In"
									className="flex items-center justify-center"
								>
									<UserIcon className="size-[22px]" />
								</button>
							</SignInButton>
						</Show>
						<Show when="signed-in">
							<UserButton
								appearance={{
									elements: {
										userButtonAvatarBox: "!size-[26px] !rounded-full",
										userButtonTrigger: "!h-[26px] !w-[26px] !rounded-full",
									},
								}}
							/>
						</Show>
					</ClerkLoaded>
				</div>
				<span className="mobile-bottom-nav-tab-label">Account</span>
			</div>
		</nav>
	);
};

export { MobileBottomNav };
