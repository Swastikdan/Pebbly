import {
  ClerkLoaded,
  ClerkLoading,
  Show,
  SignInButton,
  UserButton,
} from "@clerk/react";
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
import { Link, useLocation } from "@tanstack/react-router";

import { FooterThemeSelect } from "@/components/footer-theme-select";
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
  SheetDescription,
  SheetHeader,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SITE_CONFIG } from "@/constants";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

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
    icon: <Flame className="size-4" />,
  },
  {
    name: "Now Playing",
    url: "/list/movies/now-playing",
    subtext: "In theaters",
    icon: <PlayCircle className="size-4" />,
  },
  {
    name: "Top Rated",
    url: "/list/movies/top-rated",
    subtext: "Highest rated",
    icon: <Star className="size-4" />,
  },
  {
    name: "Upcoming",
    url: "/list/movies/upcoming",
    subtext: "Releasing soon",
    icon: <Calendar className="size-4" />,
  },
];

const TV_LINKS: NavLinkItem[] = [
  {
    name: "Popular TV",
    url: "/list/tv-shows/popular",
    subtext: "Trending series",
    icon: <Flame className="size-4" />,
  },
  {
    name: "On The Air",
    url: "/list/tv-shows/on-the-air",
    subtext: "Currently airing",
    icon: <Radio className="size-4" />,
  },
  {
    name: "Top Rated",
    url: "/list/tv-shows/top-rated",
    subtext: "Highest rated",
    icon: <Star className="size-4" />,
  },
  {
    name: "Airing Today",
    url: "/list/tv-shows/airing-today",
    subtext: "New episodes",
    icon: <Clock className="size-4" />,
  },
];

const QUICK_LINKS: NavLinkItem[] = [
  {
    name: "Watchlist",
    url: "/watchlist",
    subtext: "Saved titles",
    icon: <Bookmark className="size-4" />,
    isExternal: false,
  },
  {
    name: "Search Catalog",
    url: "/search",
    subtext: "Find movies & TV",
    icon: <Search className="size-4" />,
    isExternal: false,
  },
  {
    name: "Disclaimer",
    url: "/disclaimer",
    subtext: "Terms & info",
    icon: <Info className="size-4" />,
    isExternal: false,
  },
  {
    name: "GitHub Code",
    url: SITE_CONFIG.Footerlinks.github,
    subtext: "View repository",
    icon: <Github className="size-4" />,
    isExternal: true,
  },
];

function useScrollDirection(pathname: string) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  // Reset nav visibility immediately when navigating to a new route
  useEffect(() => {
    if (pathname) {
      setHidden(false);
      lastScrollY.current = 0;
    }
  }, [pathname]);

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
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cn(
            "shrink-0 rounded-xl p-2.5",
            isActive
              ? "bg-nav-active-fg/15 text-nav-active-fg"
              : "bg-muted text-foreground",
          )}
        >
          {item.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-sm font-bold",
              isActive ? "text-nav-active-fg" : "text-foreground",
            )}
          >
            {item.name}
          </div>
          <div
            className={cn(
              "truncate text-[11px]",
              isActive ? "text-nav-active-fg/75" : "text-muted-foreground",
            )}
          >
            {item.subtext}
          </div>
        </div>
      </div>
      {badge && (
        <span
          className={cn(
            "ml-2 shrink-0 rounded-md border px-2.5 py-0.5 text-[10px] font-semibold",
            isActive
              ? "bg-nav-active-fg/15 text-nav-active-fg border-transparent"
              : "bg-muted text-muted-foreground border-border/60",
          )}
        >
          {badge}
        </span>
      )}
    </>
  );

  const baseClasses = cn(
    "flex items-center justify-between rounded-2xl border p-3 transition-[color,background-color,border-color,transform] active:scale-[0.98]",
    isActive
      ? "bg-nav-active-bg border-transparent shadow-sm"
      : "border-border bg-card",
  );

  if (item.isExternal) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClasses}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <SheetClose
      render={<Link to={item.url} search={search} />}
      className={baseClasses}
    >
      {cardContent}
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
    <div className="text-muted-foreground px-1 text-xs font-semibold tracking-wider uppercase">
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
  const isHidden = useScrollDirection(location.pathname);
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
          <div className="flex h-full w-full flex-col items-center justify-center">
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
                className="flex h-full w-full cursor-pointer flex-col items-center justify-center border-none bg-transparent p-0"
              >
                <span className="mobile-bottom-nav-tab-icon">
                  <UserIcon className="size-[24px]" />
                </span>
                <span className="mobile-bottom-nav-tab-label">Account</span>
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <div className="flex h-full w-full flex-col items-center justify-center">
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
        <SheetTrigger
          render={
            <button
              type="button"
              className="mobile-bottom-nav-tab"
              data-active="false"
              aria-label="More Options"
            />
          }
        >
          <span className="mobile-bottom-nav-tab-icon">
            <Grid className="size-[22px]" />
          </span>
          <span className="mobile-bottom-nav-tab-label">More</span>
        </SheetTrigger>

        <SheetPopup
          side="bottom"
          className="bg-background/95 z-50 flex flex-col p-0 backdrop-blur-2xl outline-none"
        >
          {/* Top handle pill */}
          <div className="flex shrink-0 justify-center pt-3 pb-1">
            <div className="bg-muted-foreground/30 h-1.5 w-12 rounded-full" />
          </div>

          <SheetHeader className="border-border/40 shrink-0 border-b px-5 pt-1 pb-3 text-left">
            <SheetTitle className="font-heading flex items-center gap-2 text-lg font-bold">
              <Grid className="text-primary size-5" />
              Explore & Navigation
            </SheetTitle>
            <SheetDescription className="text-muted-foreground text-xs">
              Browse movies, TV shows, AI tools, and site pages
            </SheetDescription>
          </SheetHeader>

          <div className="border-border/40 flex shrink-0 items-center justify-between border-b px-5 py-1.5">
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Theme
            </span>
            <FooterThemeSelect />
          </div>

          <div className="min-h-0 flex-1 scrollbar-none space-y-5 overflow-y-auto px-4 py-4 pb-10">
            {/* Featured & Admin */}
            {(isAdmin || hasAiRecommendations) && (
              <div className="space-y-2">
                <div className="text-muted-foreground px-1 text-xs font-semibold tracking-wider uppercase">
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
        </SheetPopup>
      </Sheet>
    </nav>
  );
};

export { MobileBottomNav };
