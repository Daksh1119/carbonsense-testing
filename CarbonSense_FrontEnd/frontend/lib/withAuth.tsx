'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store';

/**
 * withAuth HOC
 * Higher-order component for protecting page components
 * Usage: export default withAuth(YourPage, { requiredRole: 'admin' });
 */
export interface WithAuthOptions {
  requiredRole?: 'admin' | 'manager' | 'member' | 'viewer';
  redirectTo?: string;
}

export default function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { requiredRole, redirectTo = '/login' } = options;

  return function ProtectedComponent(props: P) {
    const router = useRouter();
    const { isAuthenticated, user, isLoading } = useUserStore();

    useEffect(() => {
      if (isLoading) return;

      if (!isAuthenticated) {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        router.push(redirectTo);
        return;
      }

      if (requiredRole && user) {
        const roleHierarchy: Record<string, number> = {
          viewer: 1,
          member: 2,
          manager: 3,
          admin: 4,
        };

        const userRoleLevel = roleHierarchy[user.role] || 0;
        const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

        if (userRoleLevel < requiredRoleLevel) {
          router.push('/unauthorized');
          return;
        }
      }
    }, [isAuthenticated, user, requiredRole, isLoading, router]);

    if (isLoading || !isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Verifying access...</p>
          </div>
        </div>
      );
    }

    if (requiredRole && user) {
      const roleHierarchy: Record<string, number> = {
        viewer: 1,
        member: 2,
        manager: 3,
        admin: 4,
      };

      const userRoleLevel = roleHierarchy[user.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        return null;
      }
    }

    return <Component {...props} />;
  };
}
