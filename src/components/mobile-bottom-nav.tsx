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

const MobileBottomNav = () => {
	const location = useLocation();
	const isHidden = useScrollDirection();
	const { isAdmin, hasFeature } = usePermissions();
	const hasAiRecommendations = hasFeature("ai-recommendations");

	const mainTabs: TabItem[] = [
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

	const isTabActive = (tab: TabItem) => {
		if (tab.matchExact) {
			return location.pathname === tab.href;
		}
		return location.pathname.startsWith(tab.href);
	};

	const movieLinks = [
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

	const tvLinks = [
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

	const quickLinks = [
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

	return (
		<nav
			className={`mobile-bottom-nav md:hidden ${isHidden ? "mobile-bottom-nav-hidden" : ""}`}
			aria-label="Mobile Navigation"
		>
			{/* 1. Home, 2. Search, 3. Watchlist */}
			{mainTabs.map((tab) => {
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

			{/* 4. Account Tab */}
			<div className="mobile-bottom-nav-tab" data-active="false">
				<div className="mobile-bottom-nav-tab-icon mobile-bottom-nav-account">
					<ClerkLoading>
						<UserIcon className="size-[24px]" />
					</ClerkLoading>
					<ClerkLoaded>
						<Show when="signed-out">
							<SignInButton mode="modal">
								<button
									type="button"
									aria-label="Sign In"
									className="flex items-center justify-center cursor-pointer"
								>
									<UserIcon className="size-[24px]" />
								</button>
							</SignInButton>
						</Show>
						<Show when="signed-in">
							<UserButton
								appearance={{
									elements: {
										userButtonAvatarBox: "!size-[28px] !rounded-full",
										userButtonTrigger: "!h-[28px] !w-[28px] !rounded-full",
									},
								}}
							/>
						</Show>
					</ClerkLoaded>
				</div>
				<span className="mobile-bottom-nav-tab-label">Account</span>
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
					className="border-t border-white/10 bg-background/95 backdrop-blur-2xl max-h-[88vh] rounded-t-[28px] p-0 shadow-2xl overflow-hidden outline-none flex flex-col z-50"
				>
					{/* Top handle pill */}
					<div className="pt-3 pb-1 flex justify-center">
						<div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
					</div>

					<SheetHeader className="px-5 pt-1 pb-3 text-left border-b border-border/40">
						<SheetTitle className="text-lg font-bold font-heading flex items-center gap-2">
							<Grid className="size-5 text-primary" />
							Explore & Navigation
						</SheetTitle>
						<SheetDescription className="text-xs text-muted-foreground">
							Browse movies, TV shows, AI tools, and site pages
						</SheetDescription>
					</SheetHeader>

					<div className="scrollbar-none overflow-y-auto px-4 py-4 space-y-5 max-h-[calc(88vh-80px)] pb-10">
						{/* Featured & Admin */}
						{(isAdmin || hasAiRecommendations) && (
							<div className="space-y-2">
								<div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase px-1">
									Featured
								</div>

								<div className="grid grid-cols-1 gap-2">
									{isAdmin && (
										<SheetClose asChild>
											<Link
												to="/admin"
												className={`flex items-center justify-between rounded-2xl border border-white/10 bg-secondary/30 p-3 transition-colors active:scale-[0.98] ${
													location.pathname === "/admin"
														? "ring-2 ring-primary/60 border-primary/50 bg-secondary/80"
														: ""
												}`}
											>
												<div className="flex items-center gap-3 min-w-0">
													<div className="rounded-xl bg-muted/60 p-2.5 text-foreground shrink-0">
														<Shield className="size-5" />
													</div>
													<div className="min-w-0">
														<div className="font-bold text-sm text-foreground">
															Admin Dashboard
														</div>
														<div className="text-xs text-muted-foreground truncate">
															Manage users, permissions & system
														</div>
													</div>
												</div>
												<span className="rounded-full bg-muted px-2.5 py-0.5 font-semibold text-[10px] text-muted-foreground border border-border/50 shrink-0 ml-2">
													ADMIN
												</span>
											</Link>
										</SheetClose>
									)}

									{hasAiRecommendations && (
										<SheetClose asChild>
											<Link
												to="/recommendations"
												search={{ activeId: undefined }}
												className={`flex items-center justify-between rounded-2xl border border-white/10 bg-secondary/30 p-3 transition-colors active:scale-[0.98] ${
													location.pathname === "/recommendations"
														? "ring-2 ring-primary/60 border-primary/50 bg-secondary/80"
														: ""
												}`}
											>
												<div className="flex items-center gap-3 min-w-0">
													<div className="rounded-xl bg-muted/60 p-2.5 text-foreground shrink-0">
														<Sparkles className="size-5" />
													</div>
													<div className="min-w-0">
														<div className="font-bold text-sm text-foreground">
															AI Recommendations
														</div>
														<div className="text-xs text-muted-foreground truncate">
															Personalized picks powered by AI
														</div>
													</div>
												</div>
												<span className="rounded-full bg-muted px-2.5 py-0.5 font-semibold text-[10px] text-muted-foreground border border-border/50 shrink-0 ml-2">
													AI
												</span>
											</Link>
										</SheetClose>
									)}
								</div>
							</div>
						)}

						{/* Movies Grid */}
						<div className="space-y-2">
							<div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase px-1">
								Movies
							</div>
							<div className="grid grid-cols-2 gap-2">
								{movieLinks.map((item) => {
									const isActive = location.pathname === item.url;
									return (
										<SheetClose asChild key={item.url}>
											<Link
												to={item.url}
												className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-secondary/30 p-3 transition-colors active:scale-[0.98] ${
													isActive
														? "ring-2 ring-primary/60 border-primary/50 bg-secondary/80"
														: ""
												}`}
											>
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
											</Link>
										</SheetClose>
									);
								})}
							</div>
						</div>

						{/* TV Shows Grid */}
						<div className="space-y-2">
							<div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase px-1">
								TV Shows
							</div>
							<div className="grid grid-cols-2 gap-2">
								{tvLinks.map((item) => {
									const isActive = location.pathname === item.url;
									return (
										<SheetClose asChild key={item.url}>
											<Link
												to={item.url}
												className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-secondary/30 p-3 transition-colors active:scale-[0.98] ${
													isActive
														? "ring-2 ring-primary/60 border-primary/50 bg-secondary/80"
														: ""
												}`}
											>
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
											</Link>
										</SheetClose>
									);
								})}
							</div>
						</div>

						{/* Links Grid */}
						<div className="space-y-2">
							<div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase px-1">
								Links
							</div>
							<div className="grid grid-cols-2 gap-2">
								{quickLinks.map((item) => {
									const isActive =
										!item.isExternal && location.pathname === item.url;
									if (item.isExternal) {
										return (
											<a
												key={item.name}
												href={item.url}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-3 rounded-2xl border border-white/10 bg-secondary/30 p-3 transition-colors active:scale-[0.98]"
											>
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
											</a>
										);
									}
									return (
										<SheetClose asChild key={item.url}>
											<Link
												to={item.url}
												className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-secondary/30 p-3 transition-colors active:scale-[0.98] ${
													isActive
														? "ring-2 ring-primary/60 border-primary/50 bg-secondary/80"
														: ""
												}`}
											>
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
											</Link>
										</SheetClose>
									);
								})}
							</div>
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</nav>
	);
};

export { MobileBottomNav };
