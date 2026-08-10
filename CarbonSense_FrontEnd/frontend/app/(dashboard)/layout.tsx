"use client";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState } from 'react';
import { useUserStore } from '@/store';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
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
  BookOpen,
  X,
} from 'lucide-react';

/**
 * Manager nav — same core modules as admin but scoped to org data.
 * Excludes platform-admin-only paths (admin/companies, admin/managers, admin/health).
 * Group 2.8: Glossary added at bottom of nav.
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
  { name: "Glossary", href: "/glossary", icon: BookOpen },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useUserStore();
  const router = useRouter();

  // Group 2.1 — partial profile banner (dismissible per-session)
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    // Only admin and manager may access this layout
    if (!isAuthenticated || !user || !['admin', 'manager'].includes(user.role)) {
      router.replace('/unauthorized');
    }
  }, [user, isAuthenticated, isLoading, router]);

  // Fetch profile_status for manager to show partial-profile banner
  useEffect(() => {
    if (user?.role !== 'manager' || !user?.organizationId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('organizations')
          .select('profile_status')
          .eq('id', user.organizationId)
          .single();
        if (data?.profile_status === 'partial') setProfileStatus('partial');
      } catch { /* non-fatal */ }
    })();
  }, [user]);

  const isManager = user?.role === 'manager';
  const showBanner = isManager && profileStatus === 'partial' && !bannerDismissed;

  return (
    <ProtectedRoute requiredRole={['admin', 'manager']}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          navItems={isManager ? managerNavItems : undefined}
          role={user?.role as 'admin' | 'manager' | 'viewer' | undefined}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Group 2.1 — partial profile banner */}
          {showBanner && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
              <p className="text-sm text-amber-300/90">
                📋 <strong>Your company profile is incomplete.</strong>{' '}
                <Link href="/onboarding/company-profile?edit=true" className="underline hover:text-amber-200 transition-colors">
                  Complete it
                </Link>{' '}
                for a more accurate carbon footprint estimate.
              </p>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-amber-400/60 hover:text-amber-300 transition-colors flex-shrink-0"
                aria-label="Dismiss banner"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
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
