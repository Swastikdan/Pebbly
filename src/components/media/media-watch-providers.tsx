import { ExternalLinkIcon, TicketIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { MediaType } from "@/lib/media-types";
import type { WatchProvider } from "@/lib/tmdb-schemas";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/components/ui/image";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_PREFIX } from "@/constants";
import { getWatchProviders } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";

const REGION_OPTIONS = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "IN", label: "India" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "JP", label: "Japan" },
  { value: "KR", label: "South Korea" },
  { value: "BR", label: "Brazil" },
  { value: "MX", label: "Mexico" },
  { value: "NL", label: "Netherlands" },
  { value: "SE", label: "Sweden" },
] as const;

const PROVIDER_GROUPS = [
  { key: "flatrate", label: "Stream" },
  { key: "free", label: "Free" },
  { key: "ads", label: "Ads" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
] as const;

const detectRegion = (): string => {
  try {
    return new Intl.Locale(navigator.language).region ?? "US";
  } catch {
    return "US";
  }
};

const sortProviders = (providers: WatchProvider[]) =>
  [...providers].sort((a, b) => a.display_priority - b.display_priority);

const dedupeProviders = (providers: WatchProvider[]) => {
  const seen = new Set<number>();
  return providers.filter((provider) => {
    if (seen.has(provider.provider_id)) return false;
    seen.add(provider.provider_id);
    return true;
  });
};

// Tiles link to TMDB's regional watch link (JustWatch); the API exposes a
// single link per region rather than per-provider URLs.
const ProviderTile = ({
  provider,
  link,
}: {
  provider: WatchProvider;
  link?: string;
}) => {
  if (!provider.logo_path) {
    return (
      <div
        role="img"
        className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-lg text-[10px] font-medium ring-1 ring-black/8 sm:size-12 dark:ring-white/12"
        title={provider.provider_name}
        aria-label={provider.provider_name}
      >
        {provider.provider_name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  const tile = (
    <Image
      src={`${IMAGE_PREFIX.PREVIEW}${provider.logo_path}`}
      alt={provider.provider_name}
      width={92}
      height={92}
      className="size-11 rounded-lg ring-1 ring-black/8 sm:size-12 dark:ring-white/12"
    />
  );

  if (!link) return tile;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      title={`Watch on ${provider.provider_name}`}
      className="inline-block shrink-0 rounded-lg outline-offset-2 transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
    >
      {tile}
    </a>
  );
};

const LoadingState = () => (
  <section className="min-h-[140px] py-3">
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-heading w-fit text-xl font-semibold md:text-2xl">
          Where to Watch
        </span>
        <Skeleton className="h-7 w-28 rounded-md" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-14 rounded-md" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
              key={index}
              className="size-11 rounded-lg sm:size-12"
            />
          ))}
        </div>
      </div>
    </div>
  </section>
);

export const MediaWatchProviders = (props: {
  id: number;
  type: MediaType;
  inTheaters?: boolean;
}) => {
  const { id, type } = props;
  const [region, setRegion] = useState<string>("US");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setRegion(detectRegion());
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.tmdb.watchProviders(id, type),
    queryFn: () => getWatchProviders({ type, id }),
  });

  const resultsByRegion = data?.results;
  const availableRegions = useMemo(() => {
    if (!resultsByRegion) return [] as string[];
    return Object.keys(resultsByRegion)
      .filter((code) => {
        const region = resultsByRegion[code];
        return (
          (region.flatrate?.length ?? 0) > 0 ||
          (region.free?.length ?? 0) > 0 ||
          (region.ads?.length ?? 0) > 0 ||
          (region.rent?.length ?? 0) > 0 ||
          (region.buy?.length ?? 0) > 0
        );
      })
      .sort();
  }, [resultsByRegion]);

  // Stable min-height wrapper avoids CLS between LoadingState (140px)
  // and the resolved rows (typically 140-200px). Mount gating keeps SSR
  // and client region consistent without unmounting the placeholder.
  if (isLoading) return <LoadingState />;

  if (!mounted) return <LoadingState />;

  if (!resultsByRegion) return isError ? null : <LoadingState />;
  if (availableRegions.length === 0) return null;

  // When the detected region has no data, fall back to a curated region
  // (US, GB, IN, ...) in the listed order instead of the alphabetically
  // first available one - alphabetically-first regions (AD, AL, ...) tend
  // to carry sparse JustWatch data, often a single streaming service,
  // which makes the section look like it only has a "Stream" row.
  const curatedFallback = REGION_OPTIONS.map((option) => option.value).find(
    (value) => availableRegions.includes(value),
  );
  const fallbackRegion = curatedFallback ?? (availableRegions[0] ?? "US");
  const effectiveRegion = availableRegions.includes(region)
    ? region
    : fallbackRegion;
  const countryData = resultsByRegion[effectiveRegion];

  const rows = PROVIDER_GROUPS.map((group) => ({
    label: group.label,
    providers: dedupeProviders(sortProviders(countryData[group.key] ?? [])),
  })).filter((row) => row.providers.length > 0);

  const regionOptions: Array<{ value: string; label: string }> =
    REGION_OPTIONS.filter((option) => availableRegions.includes(option.value));
  // Keep the trigger valid when the detected region isn't a curated option.
  if (!regionOptions.some((option) => option.value === effectiveRegion)) {
    regionOptions.push({ value: effectiveRegion, label: effectiveRegion });
  }

  return (
    <section className="min-h-[160px] py-3">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-heading w-fit text-xl font-semibold md:text-2xl">
              Where to Watch
            </span>
            {countryData.link && (
              <a
                href={countryData.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
              >
                More ways to watch
                <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
              </a>
            )}
          </div>
          <Select
            items={regionOptions}
            value={effectiveRegion}
            onValueChange={(next) => {
              if (typeof next === "string") setRegion(next);
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={`Watch region. Current: ${effectiveRegion}`}
              className="w-auto min-w-0 shrink-0 gap-1 rounded-md px-2 text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup className="min-w-0">
              {regionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>

        {props.inTheaters && (
          <div>
            <Badge
              variant="info"
              className="h-8 gap-1.5 rounded-md px-3.5 text-xs font-medium"
            >
              <TicketIcon aria-hidden="true" className="size-3.5" />
              In theaters now
            </Badge>
          </div>
        )}

        {rows.length > 0 ? (
          <div className="flex flex-col gap-4">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3 sm:gap-4">
                <span className="text-muted-foreground w-12 shrink-0 text-xs font-medium tracking-wide uppercase sm:w-14 sm:text-sm">
                  {row.label}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {row.providers.map((provider) => (
                    <ProviderTile
                      key={provider.provider_id}
                      provider={provider}
                      link={countryData.link ?? undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No streaming information available for{" "}
            {regionOptions.find((option) => option.value === effectiveRegion)
              ?.label ?? effectiveRegion}
            .
          </p>
        )}

        <p className="text-muted-foreground text-xs">
          Availability data provided by{" "}
          <a
            href="https://www.justwatch.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline underline-offset-2"
          >
            JustWatch
          </a>{" "}
          via TMDB.
        </p>
      </div>
    </section>
  );
};
