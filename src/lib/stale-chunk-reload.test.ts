import { describe, expect, it, vi } from "vitest";

import {
  consumeStaleChunkRecovery,
  isChunkLoadError,
  reloadForStaleChunk,
} from "./stale-chunk-reload";
import { createMemoryStorage as createStorage } from "./utils";

describe("isChunkLoadError", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://x.dev/assets/a.js",
    "error loading dynamically imported module: https://x.dev/assets/a.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/a.css",
  ])("matches %s", (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of null"))).toBe(
      false,
    );
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("reloadForStaleChunk", () => {
  it("reloads once and blocks a second reload inside the guard window", () => {
    const storage = createStorage();
    const reload = vi.fn();

    expect(reloadForStaleChunk({ storage, now: 1_000, reload })).toBe(true);
    expect(reloadForStaleChunk({ storage, now: 5_000, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads again after the guard window for a later deploy", () => {
    const storage = createStorage();
    const reload = vi.fn();

    reloadForStaleChunk({ storage, now: 1_000, reload });
    expect(reloadForStaleChunk({ storage, now: 60_000, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not reload when storage is unavailable", () => {
    const reload = vi.fn();
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(reloadForStaleChunk({ storage, now: 1_000, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("consumeStaleChunkRecovery", () => {
  it("returns true once after a reload", () => {
    const storage = createStorage();
    reloadForStaleChunk({ storage, now: 1_000, reload: () => {} });

    expect(consumeStaleChunkRecovery(storage)).toBe(true);
    expect(consumeStaleChunkRecovery(storage)).toBe(false);
  });

  it("keeps the guard after the recovery is consumed", () => {
    const storage = createStorage();
    const reload = vi.fn();
    reloadForStaleChunk({ storage, now: 1_000, reload });
    consumeStaleChunkRecovery(storage);

    expect(reloadForStaleChunk({ storage, now: 5_000, reload })).toBe(false);
  });

  it("returns false without a reload", () => {
    expect(consumeStaleChunkRecovery(createStorage())).toBe(false);
  });
});
