import { useClerk, useUser } from "@clerk/react";
import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { DataVersion } from "@/hooks/data-version";
import type { MutationDomain } from "@/lib/realtime-mutations";
import { fetchDataVersion } from "@/hooks/data-version";
import { clearPendingOps } from "@/hooks/pending-ops";
import { usePermissions } from "@/hooks/use-permissions";
import { subscribeToCrossTabMutations } from "@/lib/cross-tab-sync";
import { queryKeys } from "@/lib/query/keys";
import {
  hasRecentOwnMutation,
  takeOwnMutationCounts,
} from "@/lib/realtime-mutations";
import { storeUser } from "@/server/fns/users";
import { unwrap } from "@/server/schema/common";

export const UserSync = () => {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const { isBanned, isSignedIn, loading } = usePermissions();

  // Per-user revision baselines for change detection.
  const lastRevsRef = useRef<Record<string, DataVersion>>({});

  // Sync user profile data to D1 on mount / user change
  useEffect(() => {
    if (isLoaded && user) {
      unwrap(
        storeUser({
          data: {
            name: user.fullName ?? user.username ?? "Anonymous",
            email: user.primaryEmailAddress?.emailAddress,
            image: user.imageUrl,
          },
        }),
      ).catch((error) => {
        console.error("Failed to sync user to backend:", error);
      });
    }
  }, [isLoaded, user]);

  // Enforce ban: sign the user out immediately when banned status is confirmed.
  // This clears their Clerk session so there is no client-side bypass.
  useEffect(() => {
    if (!loading && isSignedIn && isBanned) {
      signOut();
    }
  }, [isBanned, isSignedIn, loading, signOut]);

  // Drop journal state (pending optimistic ops, server bases, sync timers)
  // when the session ends so nothing leaks into the next signed-in user.
  useEffect(() => {
    if (isLoaded && !user) {
      clearPendingOps(queryClient);
      // Also drop per-user revision baselines; keeping them keyed by user
      // id would leak entries across sign-out/sign-in of other accounts.
      lastRevsRef.current = {};
    }
  }, [isLoaded, user, queryClient]);

  const invalidateDomain = useCallback(
    (domain: MutationDomain) => {
      if (domain === "watchlist") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.watchlist.list(),
        });
      } else if (domain === "lists") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.lists.all(user?.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.lists.itemsPrefix(),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.lists.itemListsPrefix(),
        });
      } else if (domain === "ai") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.recommendations.history(user?.id),
        });
        // Feedback writes and homepage regeneration also live in the AI
        // revision domain, so other devices pick them up on the same poll.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.recommendations.homepage(user?.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.recommendations.feedback(user?.id),
        });
      }
    },
    [queryClient, user?.id],
  );

  // Same-browser sibling tabs learn about this tab's mutations instantly via
  // BroadcastChannel instead of waiting for the next version poll.
  useEffect(() => {
    return subscribeToCrossTabMutations(invalidateDomain);
  }, [invalidateDomain]);

  // Realtime change detection: poll the tiny per-user revision counters (1
  // row read) instead of re-fetching whole collections on an interval. When a
  // revision changes, e.g. another device/tab toggled an item, invalidate
  // the matching query group so mounted queries refetch. Cost stays O(1) no
  // matter how large the user's watchlist/lists are.
  const versionQuery = useQuery({
    queryKey: queryKeys.data.version(user?.id),
    queryFn: fetchDataVersion,
    enabled: !!isSignedIn,
    // Instant convergence when the user returns to the tab (covers
    // visibilitychange too via TanStack's focus manager) instead of
    // waiting for the next tick of the interval.
    refetchOnWindowFocus: true,
    // Adaptive cadence: burst right after own mutations (external changes
    // converge fast while the user is active), normal cadence during an
    // active session, slow when quiet, and back off when the API is
    // failing so a degraded backend isn't hammered. Pauses when hidden.
    refetchInterval: (query) => {
      if (query.state.fetchFailureCount >= 3) return 60_000;
      if (hasRecentOwnMutation(20_000)) return 4_000;
      return hasRecentOwnMutation(2 * 60_000) ? 10_000 : 30_000;
    },
  });

  // Diagnostic: a failing version poll silently disables cross-device sync
  // (the effect below bails on undefined data), so surface it loudly instead.
  useEffect(() => {
    if (versionQuery.error) {
      console.warn(
        "[user-sync] Data-version poll failed, cross-device sync is paused until this resolves:",
        versionQuery.error,
      );
    }
  }, [versionQuery.error]);

  useEffect(() => {
    if (!user?.id || versionQuery.data === undefined) return;
    const current = versionQuery.data;
    // Guard against a malformed payload (e.g. a server fn returning the
    // wrong shape) so a silent NaN comparison can't disable sync.
    if (
      typeof current.watchlistRev !== "number" ||
      typeof current.listsRev !== "number" ||
      typeof current.aiRev !== "number" ||
      typeof current.permsRev !== "number"
    ) {
      console.warn("[user-sync] Unexpected data-version payload:", current);
      return;
    }
    const prev = lastRevsRef.current[user.id];
    // Own successful mutations since the last poll. A revision delta that is
    // fully explained by the client's own writes is already reflected in its
    // cache (optimistic update + server response), so refetching would be
    // redundant, only refetch for deltas larger than our own writes.
    const own = takeOwnMutationCounts();

    if (prev) {
      if (current.watchlistRev - prev.watchlistRev > own.watchlist) {
        invalidateDomain("watchlist");
      }
      if (current.listsRev - prev.listsRev > own.lists) {
        invalidateDomain("lists");
      }
      if (current.aiRev - prev.aiRev > own.ai) {
        invalidateDomain("ai");
      }
      // Permission changes (roles, ban flag, global feature flags) are
      // never this client's own writes, any delta means refetch perms.
      if (current.permsRev !== prev.permsRev) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.permissions(user.id),
        });
      }
    }

    lastRevsRef.current[user.id] = current;
  }, [user?.id, versionQuery.data, queryClient, invalidateDomain]);

  return null;
};
