import { useUser } from "@clerk/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DefaultEmptyState } from "@/components/default-empty-state";
import { GoBack } from "@/components/go-back";
import { Spinner } from "@/components/ui/spinner";
import { queryKeys } from "@/lib/query/keys";
import { getViewingInsights } from "@/server/fns/retention";
import { unwrap } from "@/server/schema/common";

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const query = useQuery({
    queryKey: queryKeys.data.insights(year, user?.id),
    queryFn: () => unwrap(getViewingInsights({ data: { year } })),
    enabled: isSignedIn,
  });
  const data = query.data;

  if (!isLoaded || !isSignedIn) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <GoBack title="Back" />
        <h1 className="text-h1 mt-6">Viewing insights</h1>
        <p className="text-muted-foreground mt-2">
          Sign in to see your viewing patterns.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <GoBack title="Back" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Viewing insights</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Your activity, grounded in recorded playback and completion events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label
            className="text-muted-foreground text-xs"
            htmlFor="insights-year"
          >
            Year
          </label>
          <select
            id="insights-year"
            className="border-border bg-background h-9 rounded-md border px-2 text-sm"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </header>
      {query.isPending && (
        <div className="flex justify-center py-12">
          <Spinner aria-label="Loading insights" />
        </div>
      )}
      {query.error && (
        <DefaultEmptyState
          message="Insights could not be loaded."
          onReset={() => void query.refetch()}
        />
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Watch time", `${data.watchTimeMinutes} min`],
              ["Completed", String(data.completedTitles)],
              ["Started", String(data.startedTitles)],
              ["Episodes", String(data.watchedEpisodes)],
            ].map(([label, value]) => (
              <div key={label} className="border-border rounded-lg border p-4">
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <section className="border-border rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Most watched</h2>
            {data.topTitles.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">
                Play a title to start building your insights.
              </p>
            ) : (
              <ol className="mt-4 divide-y">
                {data.topTitles.map((item, index) => (
                  <li
                    key={`${item.mediaType}-${item.tmdbId}`}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-muted-foreground w-5 text-sm tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {item.title ?? `Title ${item.tmdbId}`}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {item.minutes} min
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  );
}
