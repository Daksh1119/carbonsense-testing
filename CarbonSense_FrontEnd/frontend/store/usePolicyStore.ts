import { create } from 'zustand';

interface PolicyAlert {
  id: string;
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  sectors: string[];
  deadline: string;
  actions: string[];
  isRead: boolean;
  createdAt: string;
}

interface PolicyState {
  policies: PolicyAlert[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  setPolicies: (policies: PolicyAlert[]) => void;
  addPolicy: (policy: PolicyAlert) => void;
  markAsRead: (policyId: string) => void;
  markAllAsRead: () => void;
  removePolicy: (policyId: string) => void;
  setError: (error: string | null) => void;
  setLoading: (isLoading: boolean) => void;
}

/**
 * Policy Store
 * Manages policy alerts and compliance notifications
 */
export const usePolicyStore = create<PolicyState>((set) => ({
  policies: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  setPolicies: (policies) =>
    set({
      policies,
      unreadCount: policies.filter((p) => !p.isRead).length,
    }),

  addPolicy: (policy) =>
    set((state) => ({
      policies: [policy, ...state.policies],
      unreadCount: state.unreadCount + 1,
    })),

  markAsRead: (policyId) =>
    set((state) => ({
      policies: state.policies.map((p) =>
        p.id === policyId ? { ...p, isRead: true } : p
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllAsRead: () =>
    set((state) => ({
      policies: state.policies.map((p) => ({ ...p, isRead: true })),
      unreadCount: 0,
    })),

  removePolicy: (policyId) =>
    set((state) => {
      const policyToRemove = state.policies.find((p) => p.id === policyId);
      return {
        policies: state.policies.filter((p) => p.id !== policyId),
        unreadCount: policyToRemove && !policyToRemove.isRead
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    }),

  setError: (error) =>
    set({
      error,
      isLoading: false,
    }),

  setLoading: (isLoading) =>
    set({
      isLoading,
    }),
}));
