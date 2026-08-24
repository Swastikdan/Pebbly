import type { ListsRepository, Repository, WatchlistRepository } from "./types";
import type { QueryClient } from "@tanstack/react-query";
import { useLocalListsStore } from "@/stores/local-lists-store";
import { useLocalProgressStore } from "@/stores/local-progress-store";
import { useWatchlistStore } from "@/stores/watchlist-store";
import { resolveStatusPlan } from "./status-plan";

function logLocalError(action: string, error: unknown) {
  console.error(`Failed to ${action}`, error);
}

export function createLocalRepository(queryClient: QueryClient): Repository {
  const watchlist: WatchlistRepository = {
    async toggleMembership(item, inWatchlist) {
      useWatchlistStore
        .getState()
        .setWatchlistMembershipLocal(item.id, item.media_type, inWatchlist, {
          title: item.title,
          image: item.image,
          rating: item.rating,
          release_date: item.release_date,
          overview: item.overview,
        });
    },

    setProgressStatus(id, mediaType, progressStatus, metadata, currentStatus) {
      const { action, seasonsPromise } = resolveStatusPlan(
        queryClient,
        id,
        mediaType,
        progressStatus,
        currentStatus,
      );
      const setLocalStatus =
        useWatchlistStore.getState().setProgressStatusLocal;
      const tvId = Number(id);

      if (action.type === "tv") {
        setLocalStatus(
          id,
          mediaType,
          progressStatus,
          action.progress,
          metadata,
        );

        if (action.isLeavingCompletion && !action.shouldMarkWatched) {
          useLocalProgressStore.getState().clearShowProgress(tvId);
        } else if (seasonsPromise) {
          seasonsPromise
            .then((seasons) => {
              const { markSeasonWatched } = useLocalProgressStore.getState();
              for (const season of seasons) {
                markSeasonWatched(
                  tvId,
                  season.season,
                  season.episodes,
                  action.shouldMarkWatched,
                );
              }
            })
            .catch((error) =>
              logLocalError("sync local show episode status", error),
            );
        }
        return;
      }

      setLocalStatus(id, mediaType, progressStatus, undefined, metadata);
    },

    setReaction(id, mediaType, reaction, metadata) {
      useWatchlistStore
        .getState()
        .setReactionLocal(id, mediaType, reaction, metadata);
    },

    async markEpisode(args) {
      useLocalProgressStore
        .getState()
        .markEpisodeWatched(
          args.tmdbId,
          args.season,
          args.episode,
          args.isWatched,
        );
    },

    async markSeason(args) {
      useLocalProgressStore
        .getState()
        .markSeasonWatched(
          args.tmdbId,
          args.season,
          args.episodes,
          args.isWatched,
        );
    },

    async updateProgress(args) {
      const metadata = {
        title: args.title,
        image: args.image,
        rating: args.rating,
        release_date: args.release_date,
        overview: args.overview,
      };
      if (args.progressStatus !== undefined) {
        useWatchlistStore
          .getState()
          .setProgressStatusLocal(
            String(args.tmdbId),
            args.mediaType,
            args.progressStatus,
            args.progress ?? 0,
            metadata,
          );
        return;
      }
      useWatchlistStore
        .getState()
        .setProgressLocal(
          String(args.tmdbId),
          args.mediaType,
          args.progress ?? 0,
          metadata,
        );
    },

    async removeFromContinueWatching(tmdbId, mediaType) {
      useWatchlistStore
        .getState()
        .setProgressStatusLocal(String(tmdbId), mediaType, "watch-later", 0);
      useLocalProgressStore.getState().clearShowProgress(tmdbId);
    },
  };

  const lists: ListsRepository = {
    async deleteList(listId) {
      useLocalListsStore.getState().deleteList(listId);
    },

    async createList(args) {
      return useLocalListsStore
        .getState()
        .createList(
          args.name,
          args.color,
          args.visibility,
          args.listType,
          args.description,
          args.sortType,
        );
    },

    async createListAndAddItem(args) {
      useLocalListsStore.getState().createListAndAddItem(args);
    },

    async updateList(args) {
      useLocalListsStore
        .getState()
        .updateList(
          args.listId,
          args.name,
          args.color,
          args.visibility,
          args.listType,
          args.description,
          args.sortType,
        );
    },

    async toggleListItem(args) {
      return useLocalListsStore.getState().toggleListItem(args);
    },

    async reorderListItem(args) {
      useLocalListsStore
        .getState()
        .reorderListItem(args.listId, args.orderedItems);
    },

    async cloneList(sourceListId) {
      return useLocalListsStore.getState().cloneList(sourceListId);
    },
  };

  return { ...watchlist, ...lists };
}
