import { describe, expect, it } from "vitest";

import type {
  CandidateDailyPick,
  RawContinueWatchingItem,
  SnoozeMap,
} from "@/lib/next-up-engine";
import {
  buildNextUpQueue,
  isItemSnoozed,
  snoozeItem,
  unsnoozeItem,
} from "@/lib/next-up-engine";

describe("next-up-engine", () => {
  const baseTime = 1700000000000;

  describe("snooze tracking", () => {
    it("reports item as not snoozed when map is empty", () => {
      expect(isItemSnoozed({}, "100", "movie", baseTime)).toBe(false);
    });

    it("snoozes an item for specified duration", () => {
      const snoozed = snoozeItem({}, "100", "movie", 24, baseTime);
      expect(isItemSnoozed(snoozed, "100", "movie", baseTime + 1000)).toBe(
        true,
      );
      // Expired after 25 hours
      expect(
        isItemSnoozed(snoozed, "100", "movie", baseTime + 25 * 3600 * 1000),
      ).toBe(false);
    });

    it("unsnoozes an item", () => {
      const snoozed = snoozeItem({}, "100", "movie", 24, baseTime);
      const unsnoozed = unsnoozeItem(snoozed, "100", "movie");
      expect(isItemSnoozed(unsnoozed, "100", "movie", baseTime)).toBe(false);
    });
  });

  describe("buildNextUpQueue", () => {
    const mockContinueWatching: RawContinueWatchingItem[] = [
      {
        id: "550",
        type: "movie",
        percent: 42,
        lastUpdated: baseTime - 5000,
        title: "Fight Club",
      },
      {
        id: "1399",
        type: "tv",
        percent: 10,
        lastUpdated: baseTime - 1000,
        title: "Game of Thrones",
      },
    ];

    it("sorts in-progress items by most recent activity", () => {
      const queue = buildNextUpQueue({
        continueWatching: mockContinueWatching,
        now: baseTime,
      });

      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe("1399"); // More recent lastUpdated
      expect(queue[1].id).toBe("550");
      expect(queue[0].type).toBe("tv");
      expect(queue[1].type).toBe("movie");
    });

    it("resolves next TV episode when last played is available", () => {
      const queue = buildNextUpQueue({
        continueWatching: [mockContinueWatching[1]],
        lastPlayedByTvId: { "1399": { season: 2, episode: 4 } },
        now: baseTime,
      });

      expect(queue[0].nextEpisode).toEqual({ season: 2, episode: 4 });
    });

    it("excludes snoozed items from the queue", () => {
      const snoozeMap: SnoozeMap = snoozeItem({}, "1399", "tv", 24, baseTime);

      const queue = buildNextUpQueue({
        continueWatching: mockContinueWatching,
        snoozeMap,
        now: baseTime,
      });

      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe("550");
    });

    it("appends daily pick recommendation as next discovery item when not already in queue", () => {
      const pick: CandidateDailyPick = {
        id: "999",
        type: "movie",
        title: "Inception",
      };

      const queue = buildNextUpQueue({
        continueWatching: [mockContinueWatching[0]],
        dailyPickItem: pick,
        now: baseTime,
      });

      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe("550");
      expect(queue[1].id).toBe("999");
      expect(queue[1].source).toBe("daily-pick");
    });

    it("does not duplicate daily pick if it is already in continue watching", () => {
      const pick: CandidateDailyPick = {
        id: "550",
        type: "movie",
        title: "Fight Club",
      };

      const queue = buildNextUpQueue({
        continueWatching: [mockContinueWatching[0]],
        dailyPickItem: pick,
        now: baseTime,
      });

      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe("550");
      expect(queue[0].source).toBe("continue-watching");
    });
  });
});
