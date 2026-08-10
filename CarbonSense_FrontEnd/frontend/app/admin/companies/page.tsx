'use client';

/**
 * Admin Companies Page (Groups 2.3a + 2.6)
 * - Reads live from Supabase `organizations` table & API routes
 * - Shows Sector and Company Size columns from the new profile fields
 * - Profile Status badge (not_started / partial / complete)
 * - Cascade Delete Organization button with confirmation modal
 * - Supabase Realtime subscription for live updates
 */

import { useEffect, useState, useCallback } from 'react';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import { supabase } from '@/lib/supabaseClient';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import {
  Building2,
  Users,
  Upload,
  TrendingUp,
  Search,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface OrgRow {
  id: string;
  name: string;
  sector: string | null;
  company_size_category: string | null;
  profile_status: 'not_started' | 'partial' | 'complete';
  created_at: string;
}

interface MemberRow {
  organization_id: string;
  role: string;
  status: string;
  user_profiles?: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

interface UploadRow {
  organization_id: string;
  total_emissions_tco2e: number | null;
}

interface OrgDisplay {
  id: string;
  name: string;
  sector: string;
  sizeCategory: string;
  profileStatus: 'not_started' | 'partial' | 'complete';
  managerName: string;
  viewerCount: number;
  uploadCount: number;
  emissions: string;
  joined: string;
}

function profileStatusVariant(s: string): 'success' | 'warning' | 'info' | 'default' {
  if (s === 'complete') return 'success';
  if (s === 'partial') return 'warning';
  return 'info';
}

function profileStatusLabel(s: string) {
  if (s === 'complete') return 'Profile Complete';
  if (s === 'partial') return 'Profile Partial';
  return 'No Profile';
}

export default function AdminCompaniesPage() {
  const [orgs, setOrgs] = useState<OrgDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<OrgDisplay | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Primary: API route for enriched company data
      const res = await fetch('/api/admin/companies', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const display: OrgDisplay[] = (data.companies ?? []).map((org: any) => ({
          id: org.id,
          name: org.name,
          sector: org.sector ?? '—',
          sizeCategory: org.industry ?? '—',
          profileStatus: org.profileStatus ?? 'not_started',
          managerName: org.managerName ?? '—',
          viewerCount: org.viewerCount ?? 0,
          uploadCount: 0,
          emissions: '—',
          joined: new Date(org.createdAt).toLocaleDateString('en-IN', {
            month: 'short',
            year: 'numeric',
          }),
        }));
        setOrgs(display);
      } else {
        // Fallback: Direct Supabase query
        const [orgRes, memberRes] = await Promise.all([
          supabase
            .from('organizations')
            .select('id, name, sector, company_size_category, profile_status, created_at')
            .order('created_at', { ascending: false }),
          supabase
            .from('user_profiles')
            .select('organization_id, role, first_name, last_name, email'),
        ]);

        const orgsData: OrgRow[] = (orgRes.data ?? []) as OrgRow[];
        const membersData = memberRes.data ?? [];

        const display: OrgDisplay[] = orgsData.map((org) => {
          const orgMembers = membersData.filter((m) => m.organization_id === org.id);
          const manager = orgMembers.find((m) => m.role === 'manager');
          const managerName = manager
            ? [manager.first_name, manager.last_name].filter(Boolean).join(' ') || manager.email
            : '—';
          const viewerCount = orgMembers.filter((m) => m.role === 'viewer').length;

          return {
            id: org.id,
            name: org.name,
            sector: org.sector ?? '—',
            sizeCategory: org.company_size_category ?? '—',
            profileStatus: org.profile_status ?? 'not_started',
            managerName,
            viewerCount,
            uploadCount: 0,
            emissions: '—',
            joined: new Date(org.created_at).toLocaleDateString('en-IN', {
              month: 'short',
              year: 'numeric',
            }),
          };
        });

        setOrgs(display);
      }
    } catch (err) {
      console.error('[AdminCompanies] Failed to load:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-companies-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizations' },
        () => { loadData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleDeleteCompany = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/companies?id=${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Delete failed');

      showSuccessToast(`Organization "${deleteTarget.name}" deleted cleanly.`);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      showErrorToast(err?.message ?? 'Failed to delete organization.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = orgs.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.sector.toLowerCase().includes(search.toLowerCase()) ||
      c.sizeCategory.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    {
      label: 'Total Companies',
      value: orgs.length,
      icon: Building2,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Profile Complete',
      value: orgs.filter((c) => c.profileStatus === 'complete').length,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Companies</h1>
          <p className="text-slate-400 mt-1">All registered client organizations and onboarding status.</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-2`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{isLoading ? '—' : stat.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <DashboardCard
        title="All Companies"
        subtitle={isLoading ? 'Loading…' : `${filtered.length} organisations`}
      >
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, sector, or size…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-700/50">
                  {[
                    'Company', 'Sector', 'Profile', 'Manager',
                    'Viewers', 'Joined', 'Actions',
                  ].map((col) => (
                    <th key={col} className="pb-3 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filtered.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="font-medium text-white whitespace-nowrap">{company.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">{company.sector}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={profileStatusVariant(company.profileStatus)}>
                        {profileStatusLabel(company.profileStatus)}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">{company.managerName}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        {company.viewerCount}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 text-xs whitespace-nowrap">{company.joined}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(company)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Organization"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-8">
                No companies match your search.
              </p>
            )}
          </div>
        )}
      </DashboardCard>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Organization</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{deleteTarget.name}</strong>?
              This will cascade-delete all company emissions records, facility profiles, tasks, recommendations, and invites.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCompany}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" />Delete Company</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
