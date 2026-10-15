import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

import { reloadForStaleChunk } from "@/lib/stale-chunk-reload";

// Registered before hydration so lazy() imports and router preloads that
// start during the first render are covered.
window.addEventListener("vite:preloadError", (event) => {
  if (!navigator.onLine) return;
  if (reloadForStaleChunk()) event.preventDefault();
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
