import {
	ClerkLoaded,
	ClerkLoading,
	Show,
	SignInButton,
	UserButton,
} from "@clerk/react";
import { Link, useLocation } from "@tanstack/react-router";
import {
	Bookmark,
	Calendar,
	Clock,
	Flame,
	Github,
	Grid,
	Info,
	PlayCircle,
	Radio,
	Search,
	Shield,
	Sparkles,
	Star,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BookMarkFilledIcon,
	BookMarkIcon,
	HomeFilledIcon,
	HomeIcon,
	SearchFilledIcon,
	SearchIcon,
	UserIcon,
} from "@/components/ui/icons";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { SITE_CONFIG } from "@/constants";
import { usePermissions } from "@/hooks/use-permissions";

interface TabItem {
	href: string;
	label: string;
	icon: React.ReactNode;
	activeIcon: React.ReactNode;
	matchExact?: boolean;
}

interface NavLinkItem {
	name: string;
	url: string;
	subtext: string;
	icon: React.ReactNode;
	isExternal?: boolean;
}

const MAIN_TABS: TabItem[] = [
	{
		href: "/",
		label: "Home",
		icon: <HomeIcon className="size-[24px]" />,
		activeIcon: <HomeFilledIcon className="size-[24px]" />,
		matchExact: true,
	},
	{
		href: "/search",
		label: "Search",
		icon: <SearchIcon className="size-[24px]" />,
		activeIcon: <SearchFilledIcon className="size-[24px]" />,
	},
	{
		href: "/watchlist",
		label: "Watchlist",
		icon: <BookMarkIcon className="size-[24px]" />,
		activeIcon: <BookMarkFilledIcon className="size-[24px]" />,
	},
];

const MOVIE_LINKS: NavLinkItem[] = [
	{
		name: "Popular Movies",
		url: "/list/movies/popular",
		subtext: "Trending now",
		icon: <Flame className="size-4 text-foreground" />,
	},
	{
		name: "Now Playing",
		url: "/list/movies/now-playing",
		subtext: "In theaters",
		icon: <PlayCircle className="size-4 text-foreground" />,
	},
	{
		name: "Top Rated",
		url: "/list/movies/top-rated",
		subtext: "Highest rated",
		icon: <Star className="size-4 text-foreground" />,
	},
	{
		name: "Upcoming",
		url: "/list/movies/upcoming",
		subtext: "Releasing soon",
		icon: <Calendar className="size-4 text-foreground" />,
	},
];

const TV_LINKS: NavLinkItem[] = [
	{
		name: "Popular TV",
		url: "/list/tv-shows/popular",
		subtext: "Trending series",
		icon: <Flame className="size-4 text-foreground" />,
	},
	{
		name: "On The Air",
		url: "/list/tv-shows/on-the-air",
		subtext: "Currently airing",
		icon: <Radio className="size-4 text-foreground" />,
	},
	{
		name: "Top Rated",
		url: "/list/tv-shows/top-rated",
		subtext: "Highest rated",
		icon: <Star className="size-4 text-foreground" />,
	},
	{
		name: "Airing Today",
		url: "/list/tv-shows/airing-today",
		subtext: "New episodes",
		icon: <Clock className="size-4 text-foreground" />,
	},
];

const QUICK_LINKS: NavLinkItem[] = [
	{
		name: "Watchlist",
		url: "/watchlist",
		subtext: "Saved titles",
		icon: <Bookmark className="size-4 text-foreground" />,
		isExternal: false,
	},
	{
		name: "Search Catalog",
		url: "/search",
		subtext: "Find movies & TV",
		icon: <Search className="size-4 text-foreground" />,
		isExternal: false,
	},
	{
		name: "Disclaimer",
		url: "/disclaimer",
		subtext: "Terms & info",
		icon: <Info className="size-4 text-foreground" />,
		isExternal: false,
	},
	{
		name: "GitHub Code",
		url: SITE_CONFIG.Footerlinks.github,
		subtext: "View repository",
		icon: <Github className="size-4 text-foreground" />,
		isExternal: true,
	},
];

function useScrollDirection() {
	const [hidden, setHidden] = useState(false);
	const lastScrollY = useRef(0);
	const ticking = useRef(false);

	const update = useCallback(() => {
		const currentScrollY = window.scrollY;
		const delta = currentScrollY - lastScrollY.current;

		if (Math.abs(delta) > 8) {
			setHidden(delta > 0 && currentScrollY > 60);
		}

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

const NavCard = ({
	item,
	isActive,
	badge,
	search,
}: {
	item: NavLinkItem;
	isActive?: boolean;
	badge?: string;
	search?: Record<string, unknown>;
}) => {
	const cardContent = (
		<>
			<div className="flex items-center gap-3 min-w-0 flex-1">
				<div className="rounded-xl bg-muted/60 p-2.5 text-foreground shrink-0">
					{item.icon}
				</div>
				<div className="min-w-0 flex-1">
					<div className="font-bold text-sm text-foreground truncate">
						{item.name}
					</div>
					<div className="text-[11px] text-muted-foreground truncate">
						{item.subtext}
					</div>
				</div>
			</div>
			{badge && (
				<span className="rounded-full bg-muted px-2.5 py-0.5 font-semibold text-[10px] text-muted-foreground border border-border/50 shrink-0 ml-2">
					{badge}
				</span>
			)}
		</>
	);

	const baseClasses =
		"flex items-center justify-between rounded-2xl border border-white/10 bg-secondary/30 p-3 transition-[color,background-color,border-color,transform] active:scale-[0.98]";
	const activeClasses = isActive
		? "ring-2 ring-primary/60 border-primary/50 bg-secondary/80"
		: "";

	if (item.isExternal) {
		return (
			<a
				href={item.url}
				target="_blank"
				rel="noopener noreferrer"
				className={`${baseClasses} ${activeClasses}`}
			>
				{cardContent}
			</a>
		);
	}

	return (
		<SheetClose asChild>
			<Link
				to={item.url}
				search={search}
				className={`${baseClasses} ${activeClasses}`}
			>
				{cardContent}
			</Link>
		</SheetClose>
	);
};

const NavSection = ({
	title,
	items,
	currentPath,
	columns = 2,
}: {
	title: string;
	items: NavLinkItem[];
	currentPath: string;
	columns?: 1 | 2;
}) => (
	<div className="space-y-2">
		<div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase px-1">
			{title}
		</div>
		<div
			className={`grid ${columns === 1 ? "grid-cols-1" : "grid-cols-2"} gap-2`}
		>
			{items.map((item) => (
				<NavCard
					key={item.name}
					item={item}
					isActive={!item.isExternal && currentPath === item.url}
				/>
			))}
		</div>
	</div>
);

const MobileBottomNav = () => {
	const location = useLocation();
	const isHidden = useScrollDirection();
	const { isAdmin, hasFeature } = usePermissions();
	const hasAiRecommendations = hasFeature("ai-recommendations");

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
			{/* 1. Home, 2. Search, 3. Watchlist */}
			{MAIN_TABS.map((tab) => {
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

			{/* 4. Account Tab - Expanded tap target */}
			<div className="mobile-bottom-nav-tab min-h-[44px]" data-active="false">
				<ClerkLoading>
					<div className="flex flex-col items-center justify-center w-full h-full">
						<span className="mobile-bottom-nav-tab-icon">
							<UserIcon className="size-[24px]" />
						</span>
						<span className="mobile-bottom-nav-tab-label">Account</span>
					</div>
				</ClerkLoading>
				<ClerkLoaded>
					<Show when="signed-out">
						<SignInButton mode="modal">
							<button
								type="button"
								aria-label="Sign In"
								className="flex flex-col items-center justify-center w-full h-full cursor-pointer bg-transparent border-none p-0"
							>
								<span className="mobile-bottom-nav-tab-icon">
									<UserIcon className="size-[24px]" />
								</span>
								<span className="mobile-bottom-nav-tab-label">Account</span>
							</button>
						</SignInButton>
					</Show>
					<Show when="signed-in">
						<div className="flex flex-col items-center justify-center w-full h-full">
							<span className="mobile-bottom-nav-tab-icon mobile-bottom-nav-account">
								<UserButton
									appearance={{
										elements: {
											userButtonAvatarBox: "!size-[28px] !rounded-full",
											userButtonTrigger: "!h-[28px] !w-[28px] !rounded-full",
										},
									}}
								/>
							</span>
							<span className="mobile-bottom-nav-tab-label">Account</span>
						</div>
					</Show>
				</ClerkLoaded>
			</div>

			{/* 5. More Sheet Trigger */}
			<Sheet>
				<SheetTrigger asChild>
					<button
						type="button"
						className="mobile-bottom-nav-tab"
						data-active="false"
						aria-label="More Options"
					>
						<span className="mobile-bottom-nav-tab-icon">
							<Grid className="size-[22px]" />
						</span>
						<span className="mobile-bottom-nav-tab-label">More</span>
					</button>
				</SheetTrigger>

				<SheetContent
					side="bottom"
					className="bg-background/95 backdrop-blur-2xl p-0 outline-none flex flex-col z-50"
				>
					{/* Top handle pill */}
					<div className="pt-3 pb-1 flex justify-center shrink-0">
						<div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
					</div>

					<SheetHeader className="px-5 pt-1 pb-3 text-left border-b border-border/40 shrink-0">
						<SheetTitle className="text-lg font-bold font-heading flex items-center gap-2">
							<Grid className="size-5 text-primary" />
							Explore & Navigation
						</SheetTitle>
						<SheetDescription className="text-xs text-muted-foreground">
							Browse movies, TV shows, AI tools, and site pages
						</SheetDescription>
					</SheetHeader>

					<div className="scrollbar-none overflow-y-auto px-4 py-4 space-y-5 flex-1 min-h-0 pb-10">
						{/* Featured & Admin */}
						{(isAdmin || hasAiRecommendations) && (
							<div className="space-y-2">
								<div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase px-1">
									Featured
								</div>
								<div className="grid grid-cols-1 gap-2">
									{isAdmin && (
										<NavCard
											item={{
												name: "Admin Dashboard",
												url: "/admin",
												subtext: "Manage users, permissions & system",
												icon: <Shield className="size-5" />,
											}}
											isActive={location.pathname === "/admin"}
											badge="ADMIN"
										/>
									)}
									{hasAiRecommendations && (
										<NavCard
											item={{
												name: "AI Recommendations",
												url: "/recommendations",
												subtext: "Personalized picks powered by AI",
												icon: <Sparkles className="size-5" />,
											}}
											isActive={location.pathname === "/recommendations"}
											badge="AI"
											search={{ activeId: undefined }}
										/>
									)}
								</div>
							</div>
						)}

						<NavSection
							title="Movies"
							items={MOVIE_LINKS}
							currentPath={location.pathname}
						/>

						<NavSection
							title="TV Shows"
							items={TV_LINKS}
							currentPath={location.pathname}
						/>

						<NavSection
							title="Links"
							items={QUICK_LINKS}
							currentPath={location.pathname}
						/>
					</div>
				</SheetContent>
			</Sheet>
		</nav>
	);
};

export { MobileBottomNav };
