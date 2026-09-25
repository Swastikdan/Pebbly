import { useId } from "react";

import type {
  MutationOutboxRecord,
  MutationOutboxSnapshot,
} from "@/lib/data/mutation-outbox";
import { Button } from "@/components/ui/button";

export type SyncCenterProps = {
  userId: string;
  snapshot: MutationOutboxSnapshot;
  online: boolean;
  onRetry: (id?: string) => void;
  onDiscard: (id: string) => void;
};

function labelForKind(kind: string) {
  return kind
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stateLabel(record: MutationOutboxRecord) {
  switch (record.state) {
    case "syncing":
      return "Syncing";
    case "failed":
      return record.failure?.kind === "permanent"
        ? "Needs attention"
        : "Failed";
    case "recovered":
      return "Recovered";
    case "pending":
      return "Waiting to sync";
  }
}

function timeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SyncCenter({
  userId,
  snapshot,
  online,
  onRetry,
  onDiscard,
}: SyncCenterProps) {
  const headingId = useId();
  if (!userId || snapshot.total === 0) return null;

  const hasFailed = snapshot.failed > 0;
  const statusText = !online
    ? "Offline. Changes will sync when the connection returns."
    : snapshot.syncing > 0
      ? "Syncing saved changes."
      : hasFailed
        ? "Some changes need your attention."
        : snapshot.recovered > 0
          ? "Saved changes are up to date."
          : "Waiting to sync saved changes.";

  return (
    <section
      aria-busy={snapshot.syncing > 0}
      aria-labelledby={headingId}
      className="border-border bg-background/95 fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold">
            Sync center
          </h2>
          <p aria-live="polite" className="text-muted-foreground mt-1 text-xs">
            {statusText}
          </p>
        </div>
        {hasFailed && (
          <Button
            aria-label="Retry all failed changes"
            loading={snapshot.syncing > 0}
            onClick={() => onRetry()}
            size="sm"
            variant="outline"
          >
            Retry
          </Button>
        )}
      </div>

      <ol className="mt-3 grid gap-2" aria-label="Saved changes">
        {snapshot.records.map((record) => {
          const kindLabel = labelForKind(record.kind);
          const canRetry = record.state === "failed";
          return (
            <li
              className="border-border flex items-center gap-2 border-t pt-2"
              key={record.id}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="truncate font-medium">{kindLabel}</span>
                  <span className="text-muted-foreground shrink-0">
                    {stateLabel(record)}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 text-[11px]">
                  {timeLabel(record.createdAt)}
                  {record.state === "failed" && record.failure && (
                    <span className="ml-1">
                      {record.failure.kind === "permanent"
                        ? "This change cannot be synced automatically."
                        : record.failure.message}
                    </span>
                  )}
                </div>
              </div>
              {canRetry && (
                <Button
                  aria-label={`Retry ${kindLabel}`}
                  onClick={() => onRetry(record.id)}
                  size="xs"
                  variant="outline"
                >
                  Retry
                </Button>
              )}
              <Button
                aria-label={`Discard ${kindLabel}`}
                onClick={() => onDiscard(record.id)}
                size="xs"
                variant="ghost"
              >
                Discard
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
