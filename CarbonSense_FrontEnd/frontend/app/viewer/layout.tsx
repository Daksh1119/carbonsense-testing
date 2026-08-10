'use client';

import { useUserStore } from '@/store';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { LayoutDashboard, Wind, Target, FileBarChart, User, BookOpen, ClipboardList } from 'lucide-react';

const viewerNavItems = [
  { name: 'Dashboard', href: '/viewer/dashboard', icon: LayoutDashboard },
  { name: 'My Emissions', href: '/viewer/emissions', icon: Wind },
  { name: 'Company Targets', href: '/viewer/targets', icon: Target },
  { name: 'My Tasks', href: '/viewer/my-tasks', icon: ClipboardList }, // Group 5.2
  { name: 'Reports', href: '/viewer/reports', icon: FileBarChart },
  { name: 'Profile', href: '/viewer/profile', icon: User },
  { name: 'Glossary', href: '/viewer/glossary', icon: BookOpen }, // Group 2.10
];

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUserStore();

  return (
    <ProtectedRoute requiredRole="viewer" approvalRequired>
      <div className="flex h-screen overflow-hidden">
        <Sidebar navItems={viewerNavItems} role="viewer" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar
            title="Employee Dashboard"
            subtitle={user?.organization ?? 'Your Organization'}
          />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
