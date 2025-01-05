'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WatchList } from '@/types';

// Define the state interface for the watchlist
interface WatchListState {
  watchlist: WatchList[];
  update: (item: WatchList) => void;
}

// Function to validate and deduplicate the watchlist items
const validateWatchList = (data: unknown): WatchList[] => {
  if (Array.isArray(data)) {
    const uniqueItems = new Map<string, WatchList>();
    data.forEach((item) => {
      if (item && typeof item.externalId === 'string') {
        uniqueItems.set(item.externalId, item);
      }
    });
    return Array.from(uniqueItems.values());
  }
  return [];
};

// Create the Zustand store with persistence
export const useWatchList = create<
  WatchListState,
  [['zustand/persist', WatchListState]]
>(
  persist(
    (set) => ({
      watchlist: [],
      // Update function to add or remove items from the watchlist
      update: (item) =>
        set((state) => {
          const existingItem = state.watchlist.find(
            (i) => i.externalId === item.externalId
          );
          if (existingItem) {
            // Remove the item if it already exists
            return {
              watchlist: state.watchlist.filter(
                (i) => i.externalId !== item.externalId
              ),
            };
          } else {
            // Add the item to the beginning if it does not exist
            return { watchlist: [item, ...state.watchlist] };
          }
        }),
    }),
    {
      name: 'watchlist',
      // Merge function to validate and merge persisted state with current state
      merge: (persistedState, currentState) => {
        const validatedState = validateWatchList(
          (persistedState as { watchlist: WatchList[] })?.watchlist
        );
        return {
          ...currentState,
          watchlist: validatedState.length
            ? validatedState
            : currentState.watchlist,
        };
      },
    }
  )
);
