import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  CornerDownLeft,
  Film,
  Home,
  Info,
  Search,
  Shield,
  Sparkles,
  Tv,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { getSearchResult } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

export const COMMAND_PALETTE_OPEN_EVENT = "pebbly:open-command-palette";

export interface PaletteItem {
  value: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  loading?: boolean;
  onSelect: () => void;
}

export interface PaletteGroup {
  value: string;
  items: PaletteItem[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { isAdmin, hasFeature } = usePermissions();
  const hasAiRecommendations = hasFeature("ai-recommendations");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const trimmed = query.trim();
  const normalizedQuery = trimmed.toLocaleLowerCase();

  const isSearching = trimmed.length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.tmdb.search(trimmed, 1),
    queryFn: () => getSearchResult({ query: trimmed, page: 1 }),
    enabled: open && isSearching,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const groups = useMemo<PaletteGroup[]>(() => {
    const appItems: PaletteItem[] = [
      {
        value: "home",
        label: "Home",
        icon: <Home aria-hidden="true" className="text-muted-foreground" />,
        onSelect: () => navigate({ to: "/" }),
      },
      {
        value: "watchlist",
        label: "Watchlist",
        icon: <Bookmark aria-hidden="true" className="text-muted-foreground" />,
        onSelect: () =>
          navigate({ to: "/watchlist", search: { tab: "watchlist" } }),
      },
      {
        value: "movies",
        label: "Browse movies",
        icon: <Film aria-hidden="true" className="text-muted-foreground" />,
        onSelect: () =>
          navigate({
            to: "/list/$type/$slug",
            params: { type: "movies", slug: "popular" },
          }),
      },
      {
        value: "tv",
        label: "Browse TV shows",
        icon: <Tv aria-hidden="true" className="text-muted-foreground" />,
        onSelect: () =>
          navigate({
            to: "/list/$type/$slug",
            params: { type: "tv-shows", slug: "popular" },
          }),
      },
      {
        value: "disclaimer",
        label: "Disclaimer",
        icon: <Info aria-hidden="true" className="text-muted-foreground" />,
        onSelect: () => navigate({ to: "/disclaimer" }),
      },
    ];

    if (isAdmin) {
      appItems.push({
        value: "admin",
        label: "Admin dashboard",
        icon: <Shield aria-hidden="true" className="text-muted-foreground" />,
        onSelect: () => navigate({ to: "/admin" }),
      });
    }

    if (hasAiRecommendations) {
      appItems.push({
        value: "recommendations",
        label: "AI recommendations",
        icon: <Sparkles aria-hidden="true" className="text-muted-foreground" />,
        onSelect: () =>
          navigate({ to: "/recommendations", search: { activeId: undefined } }),
      });
    }

    const matchingAppItems = isSearching
      ? appItems.filter((item) =>
          item.label.toLocaleLowerCase().includes(normalizedQuery),
        )
      : appItems.slice(0, 5);

    const resultItems = (data?.results ?? []).filter(
      (item) => item.media_type === "movie" || item.media_type === "tv",
    );

    const titleItems: PaletteItem[] = resultItems.slice(0, 8).map((item) => {
      const mediaType = item.media_type as "movie" | "tv";
      const title = (item.title ?? item.name ?? "Untitled") as string;
      const releaseDate = item.release_date || item.first_air_date;
      const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
      const displayLabel =
        year && !Number.isNaN(year) ? `${title} (${year})` : title;

      return {
        value: `${mediaType}-${item.id}`,
        label: displayLabel,
        icon:
          mediaType === "movie" ? (
            <Film aria-hidden="true" className="text-muted-foreground" />
          ) : (
            <Tv aria-hidden="true" className="text-muted-foreground" />
          ),
        shortcut: mediaType === "movie" ? "Movie" : "TV",
        onSelect: () => navigate({ to: `/${mediaType}/${item.id.toString()}` }),
      };
    });

    const nextGroups: PaletteGroup[] = [];
    if (matchingAppItems.length > 0) {
      nextGroups.push({ value: "Quick actions", items: matchingAppItems });
    }

    if (isSearching && isFetching && titleItems.length === 0) {
      nextGroups.push({
        value: "Searching…",
        items: Array.from({ length: 4 }, (_, index) => ({
          value: `loading-${index}`,
          label: "",
          icon: <Skeleton className="size-4 rounded" />,
          loading: true,
          onSelect: () => {},
        })),
      });
    } else if (isSearching && titleItems.length > 0) {
      nextGroups.push({ value: "Titles", items: titleItems });
    }

    if (isSearching) {
      nextGroups.push({
        value: "Search",
        items: [
          {
            value: `search-page-${trimmed}`,
            label: `Search for “${trimmed}”`,
            icon: (
              <Search aria-hidden="true" className="text-muted-foreground" />
            ),
            shortcut: "All results",
            onSelect: () =>
              navigate({ to: "/search", search: { query: trimmed } }),
          },
        ],
      });
    }

    return nextGroups;
  }, [
    data,
    hasAiRecommendations,
    isAdmin,
    isFetching,
    isSearching,
    navigate,
    normalizedQuery,
    trimmed,
  ]);

  function handleItemClick(item: PaletteItem) {
    if (item.loading) return;
    onOpenChange(false);
    item.onSelect();
  }

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandDialogPopup>
        <Command
          items={groups}
          mode="none"
          onValueChange={setQuery}
          value={query}
        >
          <CommandInput placeholder="Search movies, TV shows, or open a page..." />
          <CommandPanel>
            <CommandEmpty>
              <span className="text-muted-foreground flex flex-col items-center gap-2 py-2 text-sm">
                <Search aria-hidden="true" className="size-5 opacity-60" />
                {!isSearching
                  ? "Search titles or choose an action."
                  : `No results for “${trimmed}”.`}
              </span>
            </CommandEmpty>
            <CommandList>
              {(group: PaletteGroup, index: number) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.value}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: PaletteItem) => (
                        <CommandItem
                          key={item.value}
                          onClick={() => handleItemClick(item)}
                          value={item.value}
                          className="rounded-sm"
                        >
                          {item.icon}
                          {item.loading ? (
                            <Skeleton className="h-3.5 w-3/4 rounded" />
                          ) : (
                            <span className="flex-1 truncate">
                              {item.label}
                            </span>
                          )}
                          {item.shortcut && (
                            <CommandShortcut>{item.shortcut}</CommandShortcut>
                          )}
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                  {index < groups.length - 1 && <CommandSeparator />}
                </Fragment>
              )}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <KbdGroup>
                  <Kbd>
                    <ArrowUp />
                  </Kbd>
                  <Kbd>
                    <ArrowDown />
                  </Kbd>
                </KbdGroup>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                <Kbd>
                  <CornerDownLeft />
                </Kbd>
                <span>Open</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Kbd>Esc</Kbd>
              <span>Close</span>
            </div>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
