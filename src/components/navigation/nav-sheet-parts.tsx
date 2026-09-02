import type { ReactNode } from "react";
import {
  Bookmark,
  Calendar,
  Clock,
  Flame,
  Github,
  Info,
  PlayCircle,
  Radio,
  Search,
  Star,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { SheetClose } from "@/components/ui/sheet";
import { SITE_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";

/** Config data and presentational parts of the mobile "More" nav sheet. */

export interface NavLinkItem {
  name: string;
  url: string;
  subtext: string;
  icon: ReactNode;
  isExternal?: boolean;
}

export const MOVIE_LINKS: NavLinkItem[] = [
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

export const TV_LINKS: NavLinkItem[] = [
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

export const QUICK_LINKS: NavLinkItem[] = [
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

export const NavCard = ({
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
            "shrink-0 rounded-md p-2.5",
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
    "flex items-center justify-between rounded-lg border p-3 transition-[color,background-color,border-color,transform] active:scale-[0.98]",
    isActive ? "bg-nav-active-bg border-transparent" : "border-border bg-card",
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

export const NavSection = ({
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
    <div className="text-muted-foreground px-1 text-xs font-medium">
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
