'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { NullableWatchList as WatchList } from '@/types/watchlist'

interface WatchListState {
  watchlist: WatchList[] | null
  update: (item: WatchList) => void
}

const validateWatchList = (data: unknown): WatchList[] | null => {
  if (!data || !Array.isArray(data)) {
    return null
  }

  const uniqueItems = new Map<string, WatchList>()
  data.forEach((item) => {
    if (
      item &&
      typeof item === 'object' &&
      'externalId' in item &&
      typeof item.externalId === 'string'
    ) {
      uniqueItems.set(item.externalId, item as WatchList)
    }
  })

  const validatedItems = Array.from(uniqueItems.values())
  return validatedItems.length > 0 ? validatedItems : null
}

export const useWatchList = create<
  WatchListState,
  [['zustand/persist', WatchListState]]
>(
  persist(
    (set) => ({
      watchlist: null,
      update: (item: WatchList) =>
        set((state) => {
          if (!item?.externalId) {
            return state
          }

          const currentList = state.watchlist || []
          const existingItem = currentList.find(
            (i) => i?.externalId === item.externalId,
          )

          if (existingItem) {
            const filtered = currentList.filter(
              (i) => i?.externalId !== item.externalId,
            )
            return {
              watchlist: filtered.length > 0 ? filtered : null,
            }
          }

          return {
            watchlist: [item, ...currentList],
          }
        }),
    }),
    {
      name: 'watchlist',
      merge: (persistedState, currentState) => {
        const validatedList = validateWatchList(
          (persistedState as { watchlist?: WatchList[] })?.watchlist,
        )

        return {
          ...currentState,
          watchlist: validatedList ?? currentState.watchlist,
        }
      },
    },
  ),
)
