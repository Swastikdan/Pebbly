// Chunks are named by content hash and each deploy serves only its own
// build, so a tab opened before a deploy can request a chunk that no longer
// exists. One reload fetches the new HTML and entry bundle.
const RELOAD_MARKER_KEY = "pebbly:stale-chunk-reload";
// A second failure inside this window means the reload did not help, so let
// the error surface instead of looping. A later deploy can reload again.
const RELOAD_GUARD_MS = 30_000;

const CHUNK_LOAD_ERROR_MESSAGES = [
  "failed to fetch dynamically imported module", // Chromium
  "error loading dynamically imported module", // Firefox
  "importing a module script failed", // Safari
  "unable to preload css", // Vite preload helper
];

type ReloadMarker = { at: number; reported: boolean };

type ReloadOptions = {
  storage?: Pick<Storage, "getItem" | "setItem">;
  now?: number;
  reload?: () => void;
};

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const lowerMessage = message.toLowerCase();
  return CHUNK_LOAD_ERROR_MESSAGES.some((text) => lowerMessage.includes(text));
}

function readMarker(
  storage: Pick<Storage, "getItem">,
): ReloadMarker | undefined {
  try {
    const raw = storage.getItem(RELOAD_MARKER_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<ReloadMarker>;
    return typeof parsed.at === "number"
      ? { at: parsed.at, reported: parsed.reported === true }
      : undefined;
  } catch {
    return undefined;
  }
}

function writeMarker(
  storage: Pick<Storage, "setItem">,
  marker: ReloadMarker,
): boolean {
  try {
    storage.setItem(RELOAD_MARKER_KEY, JSON.stringify(marker));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reloads the page once to recover from a stale chunk. Returns false when
 * the guard blocks the reload, so the caller can report the error.
 */
export function reloadForStaleChunk({
  storage = window.sessionStorage,
  now = Date.now(),
  reload = () => window.location.reload(),
}: ReloadOptions = {}): boolean {
  const marker = readMarker(storage);
  if (marker && now - marker.at < RELOAD_GUARD_MS) return false;
  // Without the marker the guard cannot stop a reload loop.
  if (!writeMarker(storage, { at: now, reported: false })) return false;
  reload();
  return true;
}

/**
 * Returns true once after a stale-chunk reload, so the caller can record
 * the recovery a single time.
 */
export function consumeStaleChunkRecovery(
  storage: Pick<Storage, "getItem" | "setItem"> = window.sessionStorage,
): boolean {
  const marker = readMarker(storage);
  if (!marker || marker.reported) return false;
  return writeMarker(storage, { ...marker, reported: true });
}
