/** Format a UNIX timestamp as a localized short date + time. */
export function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
