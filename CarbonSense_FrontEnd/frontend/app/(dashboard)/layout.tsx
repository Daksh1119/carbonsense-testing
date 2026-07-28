"use client";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect } from 'react';
import { useUserStore } from '@/store';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Wind,
  Sparkles,
  TreePine,
  Gavel,
  ShieldCheck,
  BarChart3,
  Settings,
  Users,
} from 'lucide-react';

/**
 * Manager nav — same core modules as admin but scoped to org data.
 * Excludes platform-admin-only paths (admin/companies, admin/managers, admin/health).
 */
const managerNavItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Emissions", href: "/emissions", icon: Wind },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Recommendations", href: "/recommendations", icon: Sparkles },
  { name: "TEME", href: "/tree-engine", icon: TreePine },
  { name: "Policy", href: "/policy-intelligence", icon: Gavel },
  { name: "Compliance", href: "/compliance", icon: ShieldCheck },
  { name: "Team", href: "/team-management", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    // Only admin and manager may access this layout
    if (!isAuthenticated || !user || !['admin', 'manager'].includes(user.role)) {
      router.replace('/unauthorized');
    }
  }, [user, isAuthenticated, isLoading, router]);

  const isManager = user?.role === 'manager';

  return (
    <ProtectedRoute requiredRole={['admin', 'manager']}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          navItems={isManager ? managerNavItems : undefined}
          role={user?.role as 'admin' | 'manager' | 'viewer' | undefined}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar
            showExportButton={!isManager}
            title={isManager ? "Manager Dashboard" : undefined}
            subtitle={isManager ? (user?.organization ?? 'Your Organization') : undefined}
          />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
