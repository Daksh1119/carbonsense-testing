'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUserStore } from '@/store';
import LoadingState from '@/components/ui/LoadingState';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'analyst' | 'viewer' | 'member';
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * ProtectedRoute Component
 * Wrapper component that protects routes requiring authentication
 * Redirects to login if not authenticated or lacks required role
 */
export default function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login',
  fallback,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, isLoading } = useUserStore();

  useEffect(() => {
    // Wait for auth state to load
    if (isLoading) return;

    // Only redirect if no fallback is provided
    if (!fallback) {
      // Redirect if not authenticated
      if (!isAuthenticated) {
        sessionStorage.setItem('redirectAfterLogin', pathname);
        router.push(redirectTo);
        return;
      }

      // Check role-based access
      if (requiredRole && user) {
        const roleHierarchy: Record<string, number> = {
          viewer: 1,
          analyst: 2,
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
    }
  }, [isAuthenticated, user, requiredRole, isLoading, router, redirectTo, pathname, fallback]);

  // Show loading state while checking auth
  if (isLoading) {
    return fallback || <LoadingState message="Verifying access..." />;
  }

  // Show nothing if redirecting
  if (!isAuthenticated) {
    return fallback || null;
  }

  // Check role permission
  if (requiredRole && user) {
    const roleHierarchy: Record<string, number> = {
      viewer: 1,
      analyst: 2,
      member: 2,
      manager: 3,
      admin: 4,
    };

    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return fallback || null;
    }
  }

  return <>{children}</>;
}
