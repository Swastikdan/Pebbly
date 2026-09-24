import { useClerk, useUser } from "@clerk/react";
import { usePostHog } from "@posthog/react";
import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { DataVersion } from "@/hooks/data-version";
import type { MutationDomain } from "@/lib/cross-tab-sync";
import type { QueryClient } from "@tanstack/react-query";
import { fetchDataVersion } from "@/hooks/data-version";
import { usePermissions } from "@/hooks/use-permissions";
import { subscribeToCrossTabMutations } from "@/lib/cross-tab-sync";
import { clearPendingOps } from "@/lib/data/pending-ops";
import { listsSyncKeys, queryKeys } from "@/lib/query/keys";
import { replayRemoteMutations } from "@/lib/repository/remote-repository";
import { storeUser } from "@/server/fns/users";
import { unwrap } from "@/server/schema/common";

export function purgePrivateQueries(client: QueryClient) {
  clearPendingOps(client);
  client.removeQueries({ queryKey: ["watchlist"] });
  client.removeQueries({ queryKey: ["lists"] });
  client.removeQueries({ queryKey: ["permissions"] });
  client.removeQueries({ queryKey: ["data"] });
  client.removeQueries({ queryKey: ["admin"] });
  client.removeQueries({ queryKey: ["recommendations"] });
}

export const UserSync = () => {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const posthog = usePostHog();
  const { isBanned, isSignedIn, loading } = usePermissions();

  const lastRevsRef = useRef<Record<string, DataVersion>>({});
  const identifiedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      if (identifiedUserRef.current) {
        posthog.reset();
        purgePrivateQueries(queryClient);
        lastRevsRef.current = {};
        identifiedUserRef.current = null;
      }
      return;
    }

    if (identifiedUserRef.current && identifiedUserRef.current !== user.id) {
      posthog.reset();
      purgePrivateQueries(queryClient);
      lastRevsRef.current = {};
    }
    posthog.identify(user.id, {
      email: user.primaryEmailAddress?.emailAddress,
      name: user.fullName ?? user.username ?? undefined,
    });
    identifiedUserRef.current = user.id;
  }, [isLoaded, posthog, user, queryClient]);

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

  useEffect(() => {
    if (!loading && isSignedIn && isBanned) {
      signOut();
    }
  }, [isBanned, isSignedIn, loading, signOut]);

  // Drop journal state (pending optimistic ops, server bases, sync timers)
  // when the session ends so nothing leaks into the next signed-in user.
  useEffect(() => {
    if (!isLoaded || !user) return;

    // Replay only idempotent watchlist writes left by an interrupted request.
    // The dispatcher is user-scoped and sequential, so one failed record does
    // not reorder later intent; failures remain for the next boot.
    void replayRemoteMutations(user.id).then(() => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.watchlist.list(undefined, user.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.watchlist.allEpisodes(user.id),
      });
    });
  }, [isLoaded, user, queryClient]);

  useEffect(() => {
    if (isLoaded && !user) {
      purgePrivateQueries(queryClient);
      // Also drop per-user revision baselines; keeping them keyed by user
      // id would leak entries across sign-out/sign-in of other accounts.
      lastRevsRef.current = {};
    }
  }, [isLoaded, user, queryClient]);

  const invalidateDomain = useCallback(
    (domain: MutationDomain) => {
      if (domain === "watchlist") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.watchlist.list(undefined, user?.id),
        });
      } else if (domain === "lists") {
        for (const key of listsSyncKeys(user?.id)) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
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
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (query.state.fetchFailureCount >= 3) return 60_000;
      // Keep the poll constant. Local mutations already invalidate their
      // affected queries; the revision poll only detects other tabs/devices.
      return 10_000;
    },
  });

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
    if (prev) {
      if (current.watchlistRev !== prev.watchlistRev) {
        invalidateDomain("watchlist");
      }
      if (current.listsRev !== prev.listsRev) {
        invalidateDomain("lists");
      }
      if (current.aiRev !== prev.aiRev) {
        invalidateDomain("ai");
      }
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
