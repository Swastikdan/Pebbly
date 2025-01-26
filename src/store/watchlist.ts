'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WatchList } from '@/types/watchlist'
import { useAuthStore } from './auth-store'

// Debounce utility for syncing with server
const createDebouncedSync = () => {
  let timeoutId: NodeJS.Timeout
  let pendingChanges = false

  const sync = async (fn: () => Promise<void>) => {
    if (!pendingChanges) return
    try {
      await fn()
      pendingChanges = false
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }

  return {
    markChanged: () => {
      pendingChanges = true
    },
    scheduleSync: (fn: () => Promise<void>, ms: number) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => sync(fn), ms)
    },
    cancel: () => {
      clearTimeout(timeoutId)
      pendingChanges = false
    },
  }
}

// State interface definition
interface WatchListState {
  watchlist: WatchList[] | null // null indicates not yet loaded
  loading: boolean // true only during initial load
  isSyncing: boolean // true during background syncs
  error: string | null
  update: (item: WatchList) => void
  hydrateFromServer: () => Promise<void>
  clearLocalWatchlist: () => void
  syncWithServer: () => Promise<void>
}

// Validation helper for watchlist data
const validateWatchList = (data: unknown): WatchList[] => {
  if (!data || !Array.isArray(data)) return []
  return data.filter(
    (item): item is WatchList =>
      !!item &&
      typeof item === 'object' &&
      'externalId' in item &&
      typeof item.externalId === 'string',
  )
}

// Create Zustand store with persistence
export const useWatchList = create<WatchListState>()(
  persist(
    (set, get) => {
      const syncManager = createDebouncedSync()

      return {
        // Initial state
        watchlist: null,
        loading: true,
        isSyncing: false,
        error: null,

        // Add/Remove items from watchlist
        update: (item: WatchList) => {
          if (!item?.externalId) return

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

          // Schedule background sync
          syncManager.markChanged()
          syncManager.scheduleSync(get().syncWithServer, 5000)
        },

        // Load data from server
        hydrateFromServer: async () => {
          const { isLoggedIn } = useAuthStore.getState()

          // Handle non-logged in state
          if (!isLoggedIn) {
            set({ loading: false, watchlist: [] })
            return
          }

          // Only set loading on initial load
          if (get().watchlist === null) {
            set({ loading: true, error: null })
          }

          try {
            const response = await fetch('/api/sync')
            if (!response.ok) throw new Error('Sync failed')

            const serverWatchlist = await response.json()
            const validatedServer = validateWatchList(serverWatchlist)

            // Merge local and server data
            set((state) => {
              const currentList = state.watchlist || []
              const combinedWatchlist = [
                ...currentList,
                ...validatedServer,
              ].reduce((acc: WatchList[], current) => {
                const exists = acc.some(
                  (item) => item.externalId === current.externalId,
                )
                if (!exists) acc.push(current)
                return acc
              }, [])

              return {
                watchlist: combinedWatchlist,
                loading: false,
                error: null,
              }
            })
          } catch (err) {
            set({
              error: 'Failed to sync with server',
              loading: false,
              watchlist: [],
            })
          }
        },

        // Clear local data
        clearLocalWatchlist: () => {
          syncManager.cancel()
          set({ watchlist: [], error: null, loading: false })
        },

        // Sync with server (background operation)
        syncWithServer: async () => {
          const { watchlist } = get()
          const { isLoggedIn, email } = useAuthStore.getState()
          if (!isLoggedIn || !email) return

          set({ isSyncing: true, error: null })

          try {
            const response = await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ watchlist, email }),
            })

            if (!response.ok) throw new Error('Sync failed')
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
        loading: true, // Start with loading true
      }),
      onRehydrateStorage: () => async (state: WatchListState | undefined) => {
        if (!state) {
          useWatchList.setState({ loading: false, watchlist: [] })
          return
        }
        await state.hydrateFromServer()
      },
    },
  ),
)

// Auth state subscription - handle both login and logout
// useAuthStore.subscribe((state, prevState) => {
//   // Handle login
//   if (!prevState.isLoggedIn && state.isLoggedIn) {
//     useWatchList.getState().hydrateFromServer()
//   }

//   // Handle logout
//   if (prevState.isLoggedIn && !state.isLoggedIn) {
//     useWatchList.setState({
//       watchlist: [],
//       loading: false,
//       isSyncing: false,
//       error: null,
//     })
//   }
// })
useAuthStore.subscribe((state, prevState) => {
  const watchListStore = useWatchList.getState()

  // Handle login - merge local data with server
  if (!prevState.isLoggedIn && state.isLoggedIn) {
    // If we have local data, trigger hydration to merge
    if (watchListStore.watchlist?.length) {
      watchListStore.hydrateFromServer()
    } else {
      // No local data, just fetch from server
      useWatchList.setState({ loading: true })
      watchListStore.hydrateFromServer()
    }
  }

  // Handle logout - preserve local data
  if (prevState.isLoggedIn && !state.isLoggedIn) {
    // Keep local data but reset states
    useWatchList.setState({
      loading: false,
      isSyncing: false,
      error: null,
      watchlist: [],
    })
  }
})
