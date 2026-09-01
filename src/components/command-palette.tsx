import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Film,
  Search,
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
import { getSearchResult } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

export interface PaletteItem {
  value: string;
  label: string;
  mediaType: "movie" | "tv";
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
  const [query, setQuery] = useState("");

  // Reset the query each time the palette re-opens.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const trimmed = query.trim();

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.tmdb.search(trimmed, 1),
    queryFn: () => getSearchResult({ query: trimmed, page: 1 }),
    enabled: open && trimmed.length > 0,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const groups = useMemo<PaletteGroup[]>(() => {
    const results = (data?.results ?? [])
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .slice(0, 5);

    const toItems = (mediaType: "movie" | "tv") =>
      results
        .filter((item) => item.media_type === mediaType)
        .map((item) => ({
          value: `${mediaType}-${item.id}`,
          label: (item.title ?? item.name ?? "Untitled") as string,
          mediaType,
        }));

    return [
      { value: "Movies", items: toItems("movie") },
      { value: "TV Shows", items: toItems("tv") },
    ].filter((group) => group.items.length > 0);
  }, [data]);

  function handleItemClick(item: PaletteItem) {
    onOpenChange(false);
    navigate({ to: `/${item.mediaType}/${item.value.split("-")[1]}` });
  }

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandDialogPopup>
        <Command
          items={groups}
          mode="none"
          onValueChange={(value) => setQuery(value)}
          value={query}
        >
          <CommandInput placeholder="Search movies and TV shows..." />
          <CommandPanel>
            <CommandEmpty>
              <span className="text-muted-foreground flex flex-col items-center gap-2 py-2 text-sm">
                <Search aria-hidden="true" className="size-5 opacity-60" />
                {isFetching && trimmed.length > 0
                  ? "Searching…"
                  : trimmed.length === 0
                    ? "Start typing to search movies and TV shows."
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
                        >
                          {item.mediaType === "movie" ? (
                            <Film
                              aria-hidden="true"
                              className="text-muted-foreground"
                            />
                          ) : (
                            <Tv
                              aria-hidden="true"
                              className="text-muted-foreground"
                            />
                          )}
                          <span className="flex-1 truncate">{item.label}</span>
                          <CommandShortcut>
                            {item.mediaType === "movie" ? "Movie" : "TV"}
                          </CommandShortcut>
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
