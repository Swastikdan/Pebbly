'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { NullableWatchList as WatchList } from '@/types/watchlist'

interface WatchListState {
  watchlist: WatchList[]
  loading: boolean
  update: (item: WatchList) => void
}

const validateWatchList = (data: unknown): WatchList[] => {
  if (!data || !Array.isArray(data)) {
    return []
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

  return Array.from(uniqueItems.values())
}

export const useWatchList = create<
  WatchListState,
  [['zustand/persist', WatchListState]]
>(
  persist(
    (set) => ({
      watchlist: [],
      loading: true,
      update: (item: WatchList) =>
        set((state) => {
          if (!item?.externalId) {
            return state
          }

          const existingItem = state.watchlist.find(
            (i) => i?.externalId === item.externalId,
          )

          if (existingItem) {
            return {
              ...state,
              watchlist: state.watchlist.filter(
                (i) => i?.externalId !== item.externalId,
              ),
            }
          }

          return {
            ...state,
            watchlist: [item, ...state.watchlist],
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
          watchlist: validatedList,
          loading: false,
        }
      },
    },
  ),
)
