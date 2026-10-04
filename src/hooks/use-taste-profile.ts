import { useUser } from "@clerk/react";
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  TasteProfile,
  UpdateTasteProfileArgs,
} from "@/server/schema/taste-profile";
import { broadcastMutation } from "@/lib/cross-tab-sync";
import { queryKeys } from "@/lib/query/keys";
import {
  getTasteProfile,
  resetTasteProfile,
  updateTasteProfile,
} from "@/server/fns/taste-profile";
import { unwrap } from "@/server/schema/common";
import { DEFAULT_TASTE_PROFILE } from "@/server/schema/taste-profile";
import { useTasteProfileStore } from "@/stores/taste-profile-store";

export function useTasteProfile() {
  const { isSignedIn, isLoaded, user } = useUser();
  const queryClient = useQueryClient();

  const guestProfile = useTasteProfileStore((s) => s.profile);
  const updateGuestProfile = useTasteProfileStore((s) => s.updateProfile);
  const resetGuestProfile = useTasteProfileStore((s) => s.resetProfile);

  const serverQuery = useQuery({
    queryKey: queryKeys.recommendations.tasteProfile(user?.id),
    queryFn: () => unwrap(getTasteProfile()),
    enabled: !!isSignedIn && !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: (patch: UpdateTasteProfileArgs) =>
      unwrap(updateTasteProfile({ data: patch })),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.recommendations.tasteProfile(user?.id),
        updated,
      );
      broadcastMutation("ai");
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => unwrap(resetTasteProfile()),
    onSuccess: (resetData) => {
      queryClient.setQueryData(
        queryKeys.recommendations.tasteProfile(user?.id),
        resetData,
      );
      broadcastMutation("ai");
    },
  });

  const tasteProfile: TasteProfile = useMemo(() => {
    if (isSignedIn) {
      return serverQuery.data ?? DEFAULT_TASTE_PROFILE;
    }
    return guestProfile ?? DEFAULT_TASTE_PROFILE;
  }, [isSignedIn, serverQuery.data, guestProfile]);

  const saveProfile = useCallback(
    async (patch: UpdateTasteProfileArgs) => {
      if (isSignedIn) {
        await updateMutation.mutateAsync(patch);
      } else {
        updateGuestProfile(patch);
      }
    },
    [isSignedIn, updateMutation, updateGuestProfile],
  );

  const reset = useCallback(async () => {
    if (isSignedIn) {
      await resetMutation.mutateAsync();
    } else {
      resetGuestProfile();
    }
  }, [isSignedIn, resetMutation, resetGuestProfile]);

  return {
    tasteProfile,
    isLoading: isSignedIn ? serverQuery.isLoading : !isLoaded,
    isSaving: updateMutation.isPending || resetMutation.isPending,
    saveProfile,
    resetProfile: reset,
    isSignedIn: !!isSignedIn,
  };
}
