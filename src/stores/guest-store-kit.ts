import type { PersistOptions } from "zustand/middleware";
import { createJSONStorage } from "zustand/middleware";

import { createLRUStorage, createMemoryStorage } from "@/lib/utils";

const memoryStorage = createMemoryStorage();
const lruStorage = createLRUStorage();

export function guestPersistOptions<S>(
  name: string,
  backend: "lru" | "localStorage" = "lru",
): Pick<PersistOptions<S>, "name" | "storage"> {
  return {
    name,
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
