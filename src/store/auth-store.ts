'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isLoggedIn: boolean
  email: string | null
  setAuth: (email: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      email: null,
      setAuth: (email) => set({ isLoggedIn: true, email }),
      clearAuth: () => set({ isLoggedIn: false, email: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        email: state.email,
      }),
    },
  ),
)
