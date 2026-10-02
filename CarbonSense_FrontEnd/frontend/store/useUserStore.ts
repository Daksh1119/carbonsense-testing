import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Session } from '@supabase/supabase-js';
import { User } from '@/lib/types';
import { signOut as supabaseSignOut } from '@/lib/authHelpers';
import type { Role } from '@/lib/authHelpers';

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  supabaseSession: Session | null;

  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setSession: (session: Session | null) => void;
  login: (user: User, token: string) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
}

/**
 * User Store
 * Manages user authentication state across the application.
 * Session is synced by AuthProvider on mount via onAuthStateChange.
 */
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true, // start loading until AuthProvider resolves session
      token: null,
      supabaseSession: null,

      setUser: (user) =>
        set({ user, isAuthenticated: true }),

      setToken: (token) =>
        set({ token }),

      setSession: (session) =>
        set({
          supabaseSession: session,
          token: session?.access_token ?? null,
          isLoading: false,
        }),

      login: (user, token) =>
        set({ user, token, isAuthenticated: true, isLoading: false }),

      logout: async () => {
        await supabaseSignOut();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          supabaseSession: null,
          isLoading: false,
        });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setLoading: (loading) =>
        set({ isLoading: loading }),
    }),
    {
      name: 'carbonsense-user-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        // Do NOT persist session — let AuthProvider re-hydrate from Supabase
      }),
      // After rehydration, only force isLoading=true when there is NO persisted
      // user. If a user is already in localStorage, AuthProvider's fast path
      // will immediately set isLoading=false so the page renders without a
      // blocking spinner on every navigation.
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Only block on loading if there's no persisted authenticated user
          state.isLoading = !(state.user?.id && state.isAuthenticated);
        }
      },
    }
  )
);
