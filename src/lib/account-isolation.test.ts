import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { purgePrivateQueries } from "@/components/user-sync";
import { queryKeys } from "@/lib/query/keys";

describe("Account data isolation & cache partitioning", () => {
  it("partitions query keys by user ID so different accounts never collide", () => {
    const listKeyA = queryKeys.watchlist.list(undefined, "user_A");
    const listKeyB = queryKeys.watchlist.list(undefined, "user_B");
    expect(listKeyA).not.toEqual(listKeyB);
    expect(listKeyA[2]).toBe("user_A");
    expect(listKeyB[2]).toBe("user_B");

    const episodesKeyA = queryKeys.watchlist.episodes(100, "user_A");
    const episodesKeyB = queryKeys.watchlist.episodes(100, "user_B");
    expect(episodesKeyA).not.toEqual(episodesKeyB);
    expect(episodesKeyA[3]).toBe("user_A");
    expect(episodesKeyB[3]).toBe("user_B");

    const allEpisodesKeyA = queryKeys.watchlist.allEpisodes("user_A");
    const allEpisodesKeyB = queryKeys.watchlist.allEpisodes("user_B");
    expect(allEpisodesKeyA).not.toEqual(allEpisodesKeyB);
    expect(allEpisodesKeyA[2]).toBe("user_A");
    expect(allEpisodesKeyB[2]).toBe("user_B");

    const collectionKeyA = queryKeys.lists.collectionPage("list_1", "user_A");
    const collectionKeyB = queryKeys.lists.collectionPage("list_1", "user_B");
    expect(collectionKeyA).not.toEqual(collectionKeyB);
    expect(collectionKeyA[3]).toBe("user_A");
    expect(collectionKeyB[3]).toBe("user_B");
  });

  it("purges private user queries on sign out while preserving public TMDB cache", () => {
    const queryClient = new QueryClient();

    // Populate with user A's private queries
    queryClient.setQueryData(queryKeys.watchlist.list(undefined, "user_A"), [
      { tmdbId: 42, title: "Secret Watchlist Item" },
    ]);
    queryClient.setQueryData(queryKeys.watchlist.episodes(42, "user_A"), [
      { season: 1, episode: 1, isWatched: true },
    ]);
    queryClient.setQueryData(queryKeys.lists.all("user_A"), [
      { id: "list-1", name: "User A Favorites" },
    ]);
    queryClient.setQueryData(
      queryKeys.lists.collectionPage("list-1", "user_A"),
      { list: { id: "list-1", name: "Private List" }, role: "owner" },
    );
    queryClient.setQueryData(queryKeys.permissions("user_A"), {
      roles: ["admin"],
      isAdmin: true,
    });
    queryClient.setQueryData(queryKeys.recommendations.history("user_A"), [
      { id: "rec-1" },
    ]);

    // Populate public cache
    queryClient.setQueryData(queryKeys.tmdb.movieDetails(42), {
      title: "Inception",
      overview: "Dreams within dreams",
    });

    expect(
      queryClient.getQueryData(queryKeys.watchlist.list(undefined, "user_A")),
    ).toBeDefined();
    expect(
      queryClient.getQueryData(queryKeys.tmdb.movieDetails(42)),
    ).toBeDefined();

    // Perform sign-out / account transition purge
    purgePrivateQueries(queryClient);

    // Verify private queries are wiped
    expect(
      queryClient.getQueryData(queryKeys.watchlist.list(undefined, "user_A")),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(queryKeys.watchlist.episodes(42, "user_A")),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(queryKeys.lists.all("user_A")),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(
        queryKeys.lists.collectionPage("list-1", "user_A"),
      ),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(queryKeys.permissions("user_A")),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(queryKeys.recommendations.history("user_A")),
    ).toBeUndefined();

    // Verify public TMDB data survives
    expect(queryClient.getQueryData(queryKeys.tmdb.movieDetails(42))).toEqual({
      title: "Inception",
      overview: "Dreams within dreams",
    });
  });

  it("prevents user A's cached state from appearing when switching to user B", () => {
    const queryClient = new QueryClient();

    // User A signs in and loads watchlist
    queryClient.setQueryData(queryKeys.watchlist.list(undefined, "user_A"), [
      { tmdbId: 101, title: "User A Item" },
    ]);

    // Switch account to User B: purge triggered by UserSync
    purgePrivateQueries(queryClient);

    // User B checks their watchlist key
    const userBCache = queryClient.getQueryData(
      queryKeys.watchlist.list(undefined, "user_B"),
    );
    expect(userBCache).toBeUndefined();

    // User A cache is also gone
    const userACache = queryClient.getQueryData(
      queryKeys.watchlist.list(undefined, "user_A"),
    );
    expect(userACache).toBeUndefined();
  });
});
