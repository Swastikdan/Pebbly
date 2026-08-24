import { useUser } from "@clerk/react";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { Repository } from "./types";
import { createLocalRepository } from "./local-repository";
import { createRemoteRepository } from "./remote-repository";

export function useRepository(): Repository {
  const { isSignedIn, user } = useUser();
  const queryClient = useQueryClient();

  return useMemo(() => {
    if (isSignedIn) {
      return createRemoteRepository(queryClient, user?.id);
    }
    return createLocalRepository(queryClient);
  }, [isSignedIn, queryClient, user?.id]);
}
