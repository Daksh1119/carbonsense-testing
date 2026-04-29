'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  LayoutDashboard, Building2, Users, Activity, Shield, Settings,
} from 'lucide-react';

const adminNavItems = [
  { name: 'Platform Overview', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Companies',        href: '/admin/companies',  icon: Building2 },
  { name: 'Managers',         href: '/admin/managers',   icon: Users },
  { name: 'Platform Health',  href: '/admin/health',     icon: Activity },
  { name: 'Access Control',   href: '/admin/access',     icon: Shield },
  { name: 'Platform Settings',href: '/admin/settings',   icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="flex h-screen overflow-hidden">
        <Sidebar navItems={adminNavItems} role="admin" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar
            title="Platform Admin"
            subtitle="CarbonSense Internal"
          />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
