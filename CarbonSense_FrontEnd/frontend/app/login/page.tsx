'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf } from 'lucide-react';
import RolePortalCard from '@/components/auth/RolePortalCard';
import { useUserStore } from '@/store';
import { getRoleDashboardPath } from '@/lib/authHelpers';

/**
 * /login — Role Selector Landing Page
 * Dark glassmorphism design with animated emerald particle background.
 */
export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useUserStore();

  // If already authenticated, redirect to role dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      router.push(getRoleDashboardPath(user.role));
    }
  }, [isAuthenticated, user, router]);

  return (
    <div className="relative min-h-screen bg-slate-950 flex items-center justify-center p-6 overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-emerald-500/8 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/3 -right-16 w-64 h-64 bg-teal-500/8 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite_1s]" />
        <div className="absolute top-2/3 left-1/3 w-48 h-48 bg-emerald-400/5 rounded-full blur-3xl animate-[pulse_7s_ease-in-out_infinite_2s]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 w-full max-w-3xl mx-auto">
        {/* Logo + Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-5">
            <Leaf className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to CarbonSense
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Select your portal to access the carbon intelligence platform.
            Each role has a tailored experience.
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RolePortalCard
            role="admin"
            title="Admin Portal"
            description="Full platform access. Manage all features, users, and system configuration."
            href="/login/admin"
          />
          <RolePortalCard
            role="manager"
            title="Manager Portal"
            description="Manage your organization's carbon data, teams, and compliance."
            href="/login/manager"
          />
          <RolePortalCard
            role="viewer"
            title="Viewer Portal"
            description="View your organization's carbon insights and personal footprint."
            href="/login/viewer"
          />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-10">
          Built with scientific rigor. No greenwashing. Reduction-first, always.
        </p>
      </div>
    </div>
  );
}
