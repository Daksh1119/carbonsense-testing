'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store';
import { getRoleDashboardPath, type Role } from '@/lib/authHelpers';

/**
 * withAuth HOC
 * Higher-order component for protecting page components.
 * Updated for strict role separation (admin/manager/viewer).
 * Usage: export default withAuth(YourPage, { requiredRole: 'admin' });
 */
export interface WithAuthOptions {
  requiredRole?: Role;
  redirectTo?: string;
  approvalRequired?: boolean;
}

export default function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { requiredRole, redirectTo = '/login', approvalRequired = false } = options;

  return function ProtectedComponent(props: P) {
    const router = useRouter();
    const { isAuthenticated, user, isLoading } = useUserStore();

    useEffect(() => {
      if (isLoading) return;

      if (!isAuthenticated || !user) {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        router.push(redirectTo);
        return;
      }

      // Strict role check — no hierarchy, exact match
      if (requiredRole && user.role !== requiredRole) {
        router.push('/unauthorized');
        return;
      }

      // Approval gate for viewers
      if (approvalRequired && user.role === 'viewer' && user.approvalStatus !== 'approved') {
        // Stay on page — the component itself should show the pending screen
        return;
      }
    }, [isAuthenticated, user, isLoading, router]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Verifying access...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated || !user) return null;

    if (requiredRole && user.role !== requiredRole) return null;

    return <Component {...props} />;
  };
}
