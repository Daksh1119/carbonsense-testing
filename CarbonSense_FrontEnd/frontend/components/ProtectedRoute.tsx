'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUserStore } from '@/store';
import { type Role } from '@/lib/authHelpers';
import LoadingState from '@/components/ui/LoadingState';
import ApprovalPendingScreen from '@/components/auth/ApprovalPendingScreen';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role | Role[];
  redirectTo?: string;
  fallback?: React.ReactNode;
  approvalRequired?: boolean;
}

/**
 * ProtectedRoute Component
 * Wrapper component that protects routes requiring authentication.
 * Supports single Role or array of Roles for access.
 * Supports approvalRequired for viewer gates.
 */
export default function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login',
  fallback,
  approvalRequired = false,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, isLoading } = useUserStore();

  const hasRequiredRole = (role: Role) => {
    if (!requiredRole) return true;
    if (Array.isArray(requiredRole)) return requiredRole.includes(role);
    return role === requiredRole;
  };

  useEffect(() => {
    if (isLoading) return;

    if (!fallback) {
      if (!isAuthenticated || !user) {
        sessionStorage.setItem('redirectAfterLogin', pathname);
        router.push(redirectTo);
        return;
      }

      // Role check
      if (requiredRole && !hasRequiredRole(user.role)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [isAuthenticated, user, requiredRole, isLoading, router, redirectTo, pathname, fallback]);

  // Loading
  if (isLoading) {
    return fallback || <LoadingState message="Verifying access..." />;
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return fallback || null;
  }

  // Role mismatch
  if (requiredRole && !hasRequiredRole(user.role)) {
    return fallback || null;
  }

  // Approval gate for viewers
  if (approvalRequired && user.role === 'viewer' && user.approvalStatus !== 'approved') {
    return <ApprovalPendingScreen />;
  }

  return <>{children}</>;
}
