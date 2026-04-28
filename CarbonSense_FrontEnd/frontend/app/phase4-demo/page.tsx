'use client';

import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import DataTable from '@/components/ui/DataTable';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useUserStore } from '@/store';
import { 
  showSuccessToast, 
  showInfoToast 
} from '@/lib/toast';
import { 
  Table, 
  Shield, 
  CheckCircle, 
  Edit, 
  Trash2, 
  Eye,
  Crown,
  Users,
  UserCheck,
} from 'lucide-react';
import { clsx } from 'clsx';

// Sample data types
interface EmissionEntry {
  id: string;
  date: string;
  category: string;
  activity: string;
  amount: number;
  unit: string;
  co2Amount: number;
  status: 'approved' | 'pending' | 'rejected';
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  department: string;
  lastActive: string;
  status: 'active' | 'inactive';
}

// Sample data generators
const generateEmissionsData = (): EmissionEntry[] => {
  const categories = ['Transport', 'Energy', 'Food', 'Waste', 'Purchases'];
  const activities = ['Business Travel', 'Electricity', 'Natural Gas', 'Diesel', 'Office Supplies'];
  const statuses: ('approved' | 'pending' | 'rejected')[] = ['approved', 'pending', 'rejected'];

  return Array.from({ length: 50 }, (_, i) => ({
    id: `EMI-${String(i + 1).padStart(4, '0')}`,
    date: new Date(2024, 2, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
    category: categories[Math.floor(Math.random() * categories.length)],
    activity: activities[Math.floor(Math.random() * activities.length)],
    amount: Math.floor(Math.random() * 500) + 10,
    unit: ['km', 'kWh', 'kg', 'L'][Math.floor(Math.random() * 4)],
    co2Amount: Math.floor(Math.random() * 100) + 5,
    status: statuses[Math.floor(Math.random() * statuses.length)],
  }));
};

const generateTeamData = (): TeamMember[] => {
  const names = ['Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince', 'Ethan Hunt', 'Fiona Apple', 'George Lucas', 'Hannah Montana'];
  const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'];
  const roles: ('admin' | 'manager' | 'viewer')[] = ['admin', 'manager', 'viewer'];

  return Array.from({ length: 20 }, (_, i) => ({
    id: `USR-${String(i + 1).padStart(3, '0')}`,
    name: names[i % names.length],
    email: names[i % names.length].toLowerCase().replace(' ', '.') + '@carbonsense.com',
    role: roles[Math.floor(Math.random() * roles.length)],
    department: departments[Math.floor(Math.random() * departments.length)],
    lastActive: `${Math.floor(Math.random() * 24)} hours ago`,
    status: Math.random() > 0.3 ? 'active' : 'inactive',
  }));
};

/**
 * Phase 4 Demo Page
 * Demonstrates TanStack Table and Protected Routes
 */
export default function Phase4DemoPage() {
  const { user, isAuthenticated, login, logout } = useUserStore();
  const [emissionsData] = useState<EmissionEntry[]>(generateEmissionsData());
  const [teamData] = useState<TeamMember[]>(generateTeamData());

  // Emissions table columns
  const emissionsColumns: ColumnDef<EmissionEntry>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: (info) => (
        <span className="font-mono text-xs text-slate-400">{info.getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: (info) => {
        const dateStr = info.getValue() as string;
        // Format: YYYY-MM-DD to DD/MM/YYYY consistently
        const [year, month, day] = dateStr.split('-');
        return <span className="text-slate-300">{`${day}/${month}/${year}`}</span>;
      },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: (info) => (
        <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'activity',
      header: 'Activity',
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: (info) => {
        const row = info.row.original;
        return `${info.getValue()} ${row.unit}`;
      },
    },
    {
      accessorKey: 'co2Amount',
      header: 'CO₂ (kg)',
      cell: (info) => (
        <span className="font-semibold text-emerald-400">{info.getValue() as number}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        return (
          <span
            className={clsx(
              'px-2 py-1 rounded-full text-xs font-medium',
              status === 'approved' && 'bg-emerald-500/10 text-emerald-400',
              status === 'pending' && 'bg-orange-500/10 text-orange-400',
              status === 'rejected' && 'bg-red-500/10 text-red-400'
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: () => (
        <div className="flex items-center gap-2">
          <button
            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // Team table columns
  const teamColumns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: (info) => (
        <div>
          <div className="font-medium text-slate-200">{info.getValue() as string}</div>
          <div className="text-xs text-slate-500">{info.row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: (info) => {
        const role = info.getValue() as string;
        const icons = {
          admin: Crown,
          manager: Users,
          member: UserCheck,
          viewer: Eye,
        };
        const Icon = icons[role as keyof typeof icons] || UserCheck;
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-slate-400" />
            <span className="capitalize text-slate-300">{role}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'department',
      header: 'Department',
    },
    {
      accessorKey: 'lastActive',
      header: 'Last Active',
      cell: (info) => (
        <span className="text-sm text-slate-400">{info.getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        return (
          <span
            className={clsx(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              status === 'active' && 'bg-emerald-500/10 text-emerald-400',
              status === 'inactive' && 'bg-slate-500/10 text-slate-400'
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', status === 'active' ? 'bg-emerald-400' : 'bg-slate-400')} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
  ];

  const handleExport = () => {
    showSuccessToast('Data exported successfully!');
  };

  const mockLogin = (role: 'admin' | 'manager' | 'viewer') => {
    login({
      id: '1',
      name: 'Demo User',
      email: 'demo@carbonsense.com',
      role,
      organizationId: 'demo-org',
      createdAt: new Date().toISOString(),
    }, 'mock-token');
    showInfoToast(`Logged in as ${role}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">
            Phase 4 Feature Demonstration
          </h1>
          <p className="text-slate-400">
            Advanced data tables with TanStack Table and Protected Route authentication
          </p>
        </div>

        {/* Authentication Control */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-slate-50 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            Authentication Control
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">Current Status</h3>
              <div className="space-y-2 text-sm">
                <p className="text-slate-400">
                  Status: <span className={clsx('font-semibold', isAuthenticated ? 'text-emerald-400' : 'text-red-400')}>
                    {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </p>
                {user && (
                  <>
                    <p className="text-slate-400">
                      User: <span className="text-slate-200">{user.name}</span>
                    </p>
                    <p className="text-slate-400">
                      Role: <span className="text-blue-400 capitalize">{user.role}</span>
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Test Different Roles</h3>
              {isAuthenticated ? (
                <button
                  onClick={logout}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  Logout
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => mockLogin('viewer')}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                  >
                    Viewer
                  </button>

                  <button
                    onClick={() => mockLogin('manager')}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Manager
                  </button>
                  <button
                    onClick={() => mockLogin('admin')}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Admin
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature 1: Advanced Data Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-slate-50 mb-4 flex items-center gap-2">
            <Table className="w-5 h-5 text-blue-500" />
            1. Advanced Data Table (TanStack Table)
          </h2>

          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">Features Demonstrated:</h3>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>✓ Sorting (click column headers)</li>
                <li>✓ Global search filtering</li>
                <li>✓ Pagination with page size control</li>
                <li>✓ Custom cell rendering</li>
                <li>✓ Export functionality</li>
                <li>✓ Action buttons per row</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Emissions Data Table</h3>
              <DataTable
                columns={emissionsColumns}
                data={emissionsData}
                pageSize={5}
                showPagination={true}
                showSearch={true}
                showExport={true}
                onExport={handleExport}
                searchPlaceholder="Search emissions..."
              />
            </div>
          </div>
        </div>

        {/* Feature 2: Protected Route */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-slate-50 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            2. Protected Routes & Role-Based Access
          </h2>

          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">Role Hierarchy:</h3>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>👁️ <strong className="text-slate-300">Viewer</strong> - Read-only access</li>
                <li>✓ <strong className="text-slate-300">Member</strong> - Can edit own data</li>
                <li>👥 <strong className="text-slate-300">Manager</strong> - Can manage team and data</li>
                <li>👑 <strong className="text-slate-300">Admin</strong> - Full system access</li>
              </ul>
            </div>

            {/* Manager+ Only Content */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Team Management Table</h3>
                <span className="px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded text-xs font-medium">
                  Manager+ Only
                </span>
              </div>

              <ProtectedRoute
                requiredRole="manager"
                fallback={
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-8 text-center">
                    <Shield className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-orange-400 mb-2">Access Restricted</h4>
                    <p className="text-sm text-orange-300 mb-4">
                      This content requires <strong>Manager</strong> or <strong>Admin</strong> role access.
                    </p>
                    <p className="text-xs text-slate-400">
                      {isAuthenticated 
                        ? `Your role (${user?.role}) does not have sufficient permissions.`
                        : 'Please log in with appropriate credentials.'}
                    </p>
                  </div>
                }
              >
                <DataTable
                  columns={teamColumns}
                  data={teamData}
                  pageSize={5}
                  showPagination={true}
                  showSearch={true}
                  searchPlaceholder="Search team members..."
                />
              </ProtectedRoute>
            </div>
          </div>
        </div>

        {/* Success Summary */}
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-emerald-400 mb-2">
                Phase 4 Implementation Complete!
              </h3>
              <p className="text-slate-300 text-sm mb-3">
                Advanced table management and authentication system fully functional.
              </p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>✅ TanStack Table with sorting, filtering, pagination</li>
                <li>✅ Protected routes with role-based access control</li>
                <li>✅ HOC (withAuth) and component wrapper patterns</li>
                <li>✅ Authentication state management with Zustand</li>
                <li>✅ Fallback UI for unauthorized access</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
