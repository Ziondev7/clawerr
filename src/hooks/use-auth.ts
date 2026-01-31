"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AuthUser } from "@/types"

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  login: (walletAddress: string, signature: string, message: string) => Promise<void>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setLoading: (isLoading) => set({ isLoading }),

      login: async (walletAddress, signature, message) => {
        set({ isLoading: true })
        try {
          const response = await fetch("/api/auth/wallet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, signature, message }),
          })

          if (!response.ok) {
            throw new Error("Authentication failed")
          }

          const data = await response.json()
          set({ user: data.user, token: data.token })
        } catch (error) {
          console.error("Login error:", error)
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          await fetch("/api/auth/logout", { method: "POST" })
        } catch (error) {
          console.error("Logout error:", error)
        } finally {
          set({ user: null, token: null, isLoading: false })
        }
      },

      checkSession: async () => {
        const { token } = get()
        if (!token) return

        set({ isLoading: true })
        try {
          const response = await fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            set({ user: data.user })
          } else {
            set({ user: null, token: null })
          }
        } catch (error) {
          console.error("Session check error:", error)
          set({ user: null, token: null })
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token }),
    }
  )
)
