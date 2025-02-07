'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WatchList } from '@/types/watchlist'
import { useAuthStore } from './auth-store'

/**
 * Creates a debounced synchronization manager to prevent excessive server requests
 * while maintaining data consistency between client and server
 */
const createDebouncedSync = () => {
  let timeoutId: NodeJS.Timeout
  let pendingChanges = false

  return {
    /**
     * Marks that there are pending changes needing synchronization
     */
    markChanged: () => {
      pendingChanges = true
    },

    /**
     * Schedules a synchronization attempt after a specified delay
     * @param fn - Synchronization function to execute
     * @param ms - Delay in milliseconds before execution
     */
    scheduleSync: (fn: () => Promise<void>, ms: number) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(async () => {
        if (!pendingChanges) {
          return
        }
        try {
          await fn()
          pendingChanges = false
        } catch (error) {
          console.error('Sync failed:', error)
        }
      }, ms)
    },

    /**
     * Cancels any pending synchronization attempts
     */
    cancel: () => {
      clearTimeout(timeoutId)
      pendingChanges = false
    },
  }
}

interface WatchListState {
  watchlist: WatchList[] | null
  loading: boolean
  isSyncing: boolean
  error: string | null
  update: (item: WatchList) => void
  hydrateFromServer: () => Promise<void>
  clearLocalWatchlist: () => void
  syncWithServer: () => Promise<void>
}

/**
 * Validates the structure of watchlist data from unknown sources
 * @param data - Raw data to validate
 * @returns Array of validated WatchList items
 */
const validateWatchList = (data: unknown): WatchList[] => {
  if (!data || !Array.isArray(data)) {
    return []
  }
  return data.filter(
    (item): item is WatchList =>
      !!item &&
      typeof item === 'object' &&
      'externalId' in item &&
      typeof item.externalId === 'string',
  )
}

export const useWatchListStore = create<WatchListState>()(
  persist(
    (set, get) => {
      const syncManager = createDebouncedSync()

      return {
        watchlist: null,
        loading: true,
        isSyncing: false,
        error: null,

        /**
         * Updates the watchlist in local state and schedules server synchronization
         * @param item - Watchlist item to add/remove
         */
        update: (item: WatchList) => {
          if (!item?.externalId) {
            return
          }

          set((state) => {
            const currentList = state.watchlist || []
            const exists = currentList.some(
              (i) => i.externalId === item.externalId,
            )
            const newWatchlist = exists
              ? currentList.filter((i) => i.externalId !== item.externalId)
              : [item, ...currentList]

            return { watchlist: newWatchlist }
          })

          syncManager.markChanged()
          syncManager.scheduleSync(get().syncWithServer, 500)
        },

        /**
         * Hydrates state from server when authenticated, merging with local changes
         * Acts as the primary synchronization point for initial data loading
         */
        hydrateFromServer: async () => {
          const { isLoggedIn } = useAuthStore.getState()

          // For unauthenticated users, maintain local-only state
          if (!isLoggedIn) {
            set({ loading: false })
            return
          }

          // Only show loading state on initial hydration
          if (get().watchlist === null) {
            set({ loading: true, error: null })
          }

          try {
            const response = await fetch('/api/sync')
            if (!response.ok) {
              throw new Error('Sync failed')
            }

            const serverWatchlist = await response.json()
            const validatedServer = validateWatchList(serverWatchlist)

            set((state) => {
              const currentList = state.watchlist || []

              // Merge strategy: Server items take precedence, local additions preserved
              const combinedWatchlist = [
                ...validatedServer,
                ...currentList,
              ].reduce((acc: WatchList[], current) => {
                const exists = acc.some(
                  (item) => item.externalId === current.externalId,
                )
                if (!exists) {
                  acc.push(current)
                }
                return acc
              }, [])

              return {
                watchlist: combinedWatchlist,
                loading: false,
                error: null,
              }
            })

            // Schedule immediate sync to push any merged changes to server
            syncManager.markChanged()
            syncManager.scheduleSync(get().syncWithServer, 0)
          } catch (err) {
            set({
              error: 'Failed to sync with server',
              loading: false,
              watchlist: get().watchlist || [],
            })
          }
        },

        /**
         * Clears local watchlist state and cancels pending syncs
         */
        clearLocalWatchlist: () => {
          syncManager.cancel()
          set({ watchlist: [], error: null, loading: false })
        },

        /**
         * Direct synchronization with server - pushes local state when authenticated
         */
        syncWithServer: async () => {
          const { watchlist } = get()
          const { isLoggedIn, email } = useAuthStore.getState()
          if (!isLoggedIn || !email) {
            return
          }

          set({ isSyncing: true, error: null })

          try {
            const response = await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ watchlist, email }),
            })

            if (!response.ok) {
              throw new Error('Sync failed')
            }
            set({ isSyncing: false })
          } catch (err) {
            set({
              error: 'Sync failed. Changes not persisted.',
              isSyncing: false,
            })
          }
        },
      }
    },
    {
      name: 'watchlist-storage',
      partialize: (state: WatchListState) => ({
        watchlist: state.watchlist || [],
      }),
      merge: (persistedState: unknown, currentState: WatchListState) => ({
        ...currentState,
        watchlist: validateWatchList(
          (persistedState as WatchListState)?.watchlist,
        ),
        loading: true, // Trigger loading state on merge
      }),
      onRehydrateStorage: () => async (state: WatchListState | undefined) => {
        // Post-rehydration logic
        if (!state) {
          useWatchListStore.setState({ loading: false, watchlist: [] })
          return
        }
        await state.hydrateFromServer()
      },
    },
  ),
)

// Cross-store synchronization: Handle authentication state changes
useAuthStore.subscribe((state, prevState) => {
  const watchListStore = useWatchListStore.getState()

  if (!prevState.isLoggedIn && state.isLoggedIn) {
    if (watchListStore.watchlist?.length) {
      watchListStore.hydrateFromServer()
    } else {
      useWatchListStore.setState({ loading: true })
      watchListStore.hydrateFromServer()
    }
  }

  if (prevState.isLoggedIn && !state.isLoggedIn) {
    // Clear both memory state and persisted storage
    useWatchListStore.setState({
      watchlist: null,
      loading: false,
      isSyncing: false,
      error: null,
    })
    // Clear persisted data from storage
    useWatchListStore.persist.clearStorage()
  }
})
