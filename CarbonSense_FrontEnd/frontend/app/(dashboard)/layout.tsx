'use client';

import { useEffect, useState } from 'react';
import { useUserStore } from '@/store';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import ConsentModal from '@/components/auth/ConsentModal';
import {
  LayoutDashboard, Wind, BarChart3, ShieldCheck,
  Upload, Users, Settings, FileText, Target, Leaf,
} from 'lucide-react';

const managerNavItems = [
  { name: 'Dashboard',        href: '/dashboard',       icon: LayoutDashboard },
  { name: 'Emissions',        href: '/emissions',       icon: Wind },
  { name: 'Data Ingestion',   href: '/data-ingestion',  icon: Upload },
  { name: 'Analytics',        href: '/analytics',       icon: BarChart3 },
  { name: 'Detailed Log',     href: '/detailed-log',    icon: FileText },
  { name: 'Compliance',       href: '/compliance',      icon: ShieldCheck },
  { name: 'Policy',           href: '/policy-intelligence', icon: Leaf },
  { name: 'Recommendations',  href: '/recommendations', icon: Target },
  { name: 'Tree Engine',      href: '/tree-engine',     icon: Leaf },
  { name: 'Team',             href: '/team-management', icon: Users },
  { name: 'Settings',         href: '/settings',        icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading, token } = useUserStore();
  const router = useRouter();

  const [checkingConsent, setCheckingConsent] = useState(true);
  const [showConsent, setShowConsent] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState('');

  // Redirect if not a manager
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user || user.role !== 'manager') {
      router.replace('/unauthorized');
    }
  }, [user, isAuthenticated, isLoading, router]);

  // Check consent status for managers
  useEffect(() => {
    let active = true;

    const check = async () => {
      if (!user || user.role !== 'manager' || !token) {
        if (active) setCheckingConsent(false);
        return;
      }
      try {
        setCheckingConsent(true);
        const res = await fetch('/api/auth/record-consent?version=v1.0', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load consent.');
        if (active) setShowConsent(!Boolean(data?.hasConsented));
      } catch (err) {
        if (active) {
          setConsentError(err instanceof Error ? err.message : 'Failed to load consent.');
          setShowConsent(true);
        }
      } finally {
        if (active) setCheckingConsent(false);
      }
    };

    check();
    return () => { active = false; };
  }, [user, token]);

  const handleConsent = async (digitalSignature: string) => {
    setConsentLoading(true);
    setConsentError('');
    try {
      const res = await fetch('/api/auth/record-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ digitalSignature, consentVersion: 'v1.0' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to record consent.');
      setShowConsent(false);
    } catch (err) {
      setConsentError(err instanceof Error ? err.message : 'Failed to record consent.');
    } finally {
      setConsentLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="manager">
      <>
        <div className="flex h-screen overflow-hidden">
          <Sidebar navItems={managerNavItems} role="manager" />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Navbar
              title="Manager Dashboard"
              subtitle={user?.organization ?? 'Organization'}
              showExportButton
            />
            <main className="flex-1 overflow-y-auto p-6">
              {checkingConsent ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Checking consent status...
                </div>
              ) : (
                children
              )}
            </main>
          </div>
        </div>

        {consentError && (
          <div className="fixed top-4 right-4 z-[60] bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-4 py-2 rounded-lg">
            {consentError}
          </div>
        )}

        <ConsentModal
          isOpen={!checkingConsent && showConsent}
          onConsent={handleConsent}
          onClose={() => {}}
          loading={consentLoading}
        />
      </>
    </ProtectedRoute>
  );
}
