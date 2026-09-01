import { Grid, Shield, Sparkles } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "@tanstack/react-router";

import { FooterThemeSelect } from "@/components/footer-theme-select";
import {
  MOVIE_LINKS,
  NavCard,
  NavSection,
  QUICK_LINKS,
  TV_LINKS,
} from "@/components/navigation/nav-sheet-parts";
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
  SheetDescription,
  SheetHeader,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePermissions } from "@/hooks/use-permissions";

// Same code-split as the desktop nav: the account tab shows its static icon
// immediately and Clerk's widgets hydrate into it from a lazy chunk.
const AccountButton = lazy(() => import("@/components/auth/account-button"));

interface TabItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  matchExact?: boolean;
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

function useScrollDirection(pathname: string) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

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

      <div className="mobile-bottom-nav-tab min-h-[44px]" data-active="false">
        <Suspense
          fallback={
            <div className="flex h-full w-full flex-col items-center justify-center">
              <span className="mobile-bottom-nav-tab-icon">
                <UserIcon className="size-[24px]" />
              </span>
              <span className="mobile-bottom-nav-tab-label">Account</span>
            </div>
          }
        >
          <AccountButton variant="mobile" />
        </Suspense>
      </div>

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
          viewportClassName="pt-0"
          className="bg-background/95 z-50 flex h-dvh flex-col p-0 outline-hidden backdrop-blur-2xl"
          closeProps={{
            className:
              "top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 dark:bg-black/60 dark:text-white dark:hover:bg-black/80 border border-white/20 backdrop-blur-md",
          }}
        >
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
