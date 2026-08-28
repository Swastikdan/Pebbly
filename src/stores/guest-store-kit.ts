import type { PersistOptions } from "zustand/middleware";
import { createJSONStorage } from "zustand/middleware";

import { createLRUStorage, createMemoryStorage } from "@/lib/utils";

const memoryStorage = createMemoryStorage();
const lruStorage = createLRUStorage();

/**
 * Rehydration guard for every persisted store. Zustand's default merge is a
 * blind shallow spread, so a corrupted localStorage payload (non-object,
 * wrong-keyed, or an array) could replace data arrays with garbage and crash
 * the next `.filter`/`.map`. This merge only copies keys that also exist on
 * the initial state, and refuses non-object payloads outright — so a bad
 * write degrades to "fresh state", never a crash. (architecture-hardening-plan
 * item 14: persisted stores validate on rehydrate.)
 */
export type PersistedStateSanitizer<S extends object> = (
  persisted: unknown,
) => Partial<S> | null;

export function guardedMerge<S extends object>(
  persisted: unknown,
  current: S,
  sanitize?: PersistedStateSanitizer<S>,
): S {
  if (
    persisted === null ||
    typeof persisted !== "object" ||
    Array.isArray(persisted)
  ) {
    return current;
  }

  const sanitized = sanitize?.(persisted);
  if (sanitize && !sanitized) return current;

  const source = (sanitized ?? persisted) as Record<string, unknown>;
  const next = { ...current } as Record<string, unknown>;
  let changed = false;
  for (const key of Object.keys(current)) {
    if (key in source) {
      next[key] = source[key];
      changed = true;
    }
  }
  return changed ? (next as S) : current;
}

export function guestPersistOptions<S extends object>(
  name: string,
  backend: "lru" | "localStorage" = "lru",
  sanitize?: PersistedStateSanitizer<S>,
): Pick<PersistOptions<S>, "name" | "storage" | "version" | "merge"> {
  return {
    name,
    version: 1,
    merge: (persisted, current) =>
      guardedMerge<S>(persisted, current, sanitize),
    storage: createJSONStorage(() =>
      typeof window !== "undefined"
        ? backend === "lru"
          ? lruStorage
          : window.localStorage
        : memoryStorage,
    ),
  };
}

export function localId(prefix: string): string {
  return `local_${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function nextRank(
  ranks: Array<number | undefined>,
  fallback = 1,
): number {
  return ranks.length > 0
    ? Math.max(...ranks.map((r) => r ?? 0)) + 1
    : fallback;
}

export function mergeDefinedFields<T extends object>(
  row: T,
  patch: Partial<T>,
): T {
  const merged = { ...row };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}
