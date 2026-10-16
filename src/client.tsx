import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

import { reloadForStaleChunk } from "@/lib/stale-chunk-reload";

// Registered before hydration so lazy() imports and router preloads that
// start during the first render are covered.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  if (!navigator.onLine) return;
  const error = event.payload;
  const message = error instanceof Error ? error.message : String(error ?? "");
  const assetUrl = message.match(
    /https?:\/\/[^\s)]+|\/[^\s)]+\.(?:js|css)(?:\?[^\s)]*)?/i,
  )?.[0];
  if (!assetUrl) return;

  void fetch(assetUrl, { method: "HEAD", cache: "no-store" })
    .then((response) => {
      if (response.status === 404) reloadForStaleChunk();
    })
    .catch(() => {
      // A failed probe is transient or ambiguous; do not reload the page.
    });
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
