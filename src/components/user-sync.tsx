import { useClerk, useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { type DataVersion, fetchDataVersion } from "@/hooks/data-version";
import { clearPendingOps } from "@/hooks/pending-ops";
import { usePermissions } from "@/hooks/use-permissions";
import { queryKeys } from "@/lib/query/keys";
import { takeOwnMutationCounts } from "@/lib/realtime-mutations";
import { storeUser } from "@/server/fns/users";
import { unwrap } from "@/server/schema/common";

export const UserSync = () => {
	const { user, isLoaded } = useUser();
	const queryClient = useQueryClient();
	const { signOut } = useClerk();
	const { isBanned, isSignedIn, loading } = usePermissions();

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
		}
	}, [isLoaded, user, queryClient]);

	// Realtime change detection: poll the tiny per-user revision counters (1
	// row read) instead of re-fetching whole collections on an interval. When a
	// revision changes — e.g. another device/tab toggled an item — invalidate
	// the matching query group so mounted queries refetch. Cost stays O(1) no
	// matter how large the user's watchlist/lists are.
	const lastRevsRef = useRef<Record<string, DataVersion>>({});
	const versionQuery = useQuery({
		queryKey: queryKeys.data.version(user?.id),
		queryFn: fetchDataVersion,
		enabled: !!isSignedIn,
		// Pauses when the tab is hidden.
		refetchInterval: 10_000,
	});

	// Diagnostic: a failing version poll silently disables cross-device sync
	// (the effect below bails on undefined data), so surface it loudly instead.
	useEffect(() => {
		if (versionQuery.error) {
			console.warn(
				"[user-sync] Data-version poll failed — cross-device sync is paused until this resolves:",
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
			typeof current.aiRev !== "number"
		) {
			console.warn("[user-sync] Unexpected data-version payload:", current);
			return;
		}
		const prev = lastRevsRef.current[user.id];
		// Own successful mutations since the last poll. A revision delta that is
		// fully explained by the client's own writes is already reflected in its
		// cache (optimistic update + server response), so refetching would be
		// redundant — only refetch for deltas larger than our own writes.
		const own = takeOwnMutationCounts();

		if (prev) {
			if (current.watchlistRev - prev.watchlistRev > own.watchlist) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.watchlist.list(),
				});
			}
			if (current.listsRev - prev.listsRev > own.lists) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.lists.all(user.id),
				});
				void queryClient.invalidateQueries({
					queryKey: queryKeys.lists.itemsPrefix(),
				});
				void queryClient.invalidateQueries({
					queryKey: queryKeys.lists.itemListsPrefix(),
				});
			}
			if (current.aiRev - prev.aiRev > own.ai) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.recommendations.history(user.id),
				});
			}
		}

		lastRevsRef.current[user.id] = current;
	}, [user?.id, versionQuery.data, queryClient]);

	return null;
};
