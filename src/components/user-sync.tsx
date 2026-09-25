import { useClerk, useUser } from "@clerk/react";
import { usePostHog } from "@posthog/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { DataVersion } from "@/hooks/data-version";
import type { MutationDomain } from "@/lib/cross-tab-sync";
import type { MutationOutboxSnapshot } from "@/lib/data/mutation-outbox";
import type { QueryClient } from "@tanstack/react-query";
import { SyncCenter } from "@/components/sync-center";
import { fetchDataVersion } from "@/hooks/data-version";
import { usePermissions } from "@/hooks/use-permissions";
import { subscribeToCrossTabMutations } from "@/lib/cross-tab-sync";
import {
  discardMutation,
  getMutationOutboxSnapshot,
  retryFailedMutations,
  retryMutation,
  subscribeToMutationOutbox,
} from "@/lib/data/mutation-outbox";
import { clearPendingOps } from "@/lib/data/pending-ops";
import { syncMutationOutbox } from "@/lib/data/sync-center";
import { listsSyncKeys, queryKeys } from "@/lib/query/keys";
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

const EMPTY_SYNC_SNAPSHOT: MutationOutboxSnapshot = {
  records: [],
  pending: 0,
  syncing: 0,
  failed: 0,
  recovered: 0,
  permanent: 0,
  total: 0,
};

export const UserSync = () => {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const posthog = usePostHog();
  const { isBanned, isSignedIn, loading } = usePermissions();

  const lastRevsRef = useRef<Record<string, DataVersion>>({});
  const identifiedUserRef = useRef<string | null>(null);
  const userId = user?.id;
  const [syncState, setSyncState] = useState<{
    userId: string | undefined;
    snapshot: MutationOutboxSnapshot;
  }>({ userId: undefined, snapshot: EMPTY_SYNC_SNAPSHOT });
  const [online, setOnline] = useState(true);

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

  const refreshSyncSnapshot = useCallback(() => {
    setSyncState({
      userId,
      snapshot: getMutationOutboxSnapshot(userId),
    });
  }, [userId]);

  const runSync = useCallback(() => {
    if (!userId) return;
    void syncMutationOutbox(userId)
      .then(() => {
        refreshSyncSnapshot();
        if (identifiedUserRef.current !== userId) return;
        void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      })
      .catch(() => {
        refreshSyncSnapshot();
      });
  }, [queryClient, refreshSyncSnapshot, userId]);

  useEffect(() => {
    if (!isLoaded || !userId) {
      setSyncState({ userId: undefined, snapshot: EMPTY_SYNC_SNAPSHOT });
      return;
    }

    let active = true;
    const refresh = () => {
      if (active) refreshSyncSnapshot();
    };
    const handleOnline = () => {
      setOnline(true);
      runSync();
    };
    const handleOffline = () => setOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") runSync();
    };
    const unsubscribe = subscribeToMutationOutbox(refresh);
    const setInitialOnline = () => {
      if (active) setOnline(navigator.onLine !== false);
    };

    refresh();
    setInitialOnline();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", runSync);
    window.addEventListener("pageshow", runSync);
    window.addEventListener("reconnect", runSync);
    document.addEventListener("visibilitychange", handleVisibility);
    runSync();

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", runSync);
      window.removeEventListener("pageshow", runSync);
      window.removeEventListener("reconnect", runSync);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isLoaded, refreshSyncSnapshot, runSync, userId]);

  const handleRetry = useCallback(
    (id?: string) => {
      if (!userId) return;
      if (id) retryMutation(id, userId);
      else retryFailedMutations(userId);
      runSync();
    },
    [runSync, userId],
  );

  const handleDiscard = useCallback(
    (id: string) => {
      if (!userId) return;
      discardMutation(id, userId);
      refreshSyncSnapshot();
    },
    [refreshSyncSnapshot, userId],
  );

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
        void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
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

  const visibleSyncSnapshot =
    syncState.userId === userId ? syncState.snapshot : EMPTY_SYNC_SNAPSHOT;

  return (
    <SyncCenter
      userId={userId ?? ""}
      snapshot={visibleSyncSnapshot}
      online={online}
      onRetry={handleRetry}
      onDiscard={handleDiscard}
    />
  );
};
