'use client';

import { useState } from 'react';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import { Building2, Users, Upload, TrendingUp, Search, MoreHorizontal, Plus } from 'lucide-react';

const companies = [
  { id: 1, name: 'GreenTech Inc.', industry: 'Technology', manager: 'Sarah Chen', viewers: 12, uploads: 34, emissions: '1,240 tCO₂e', status: 'active', joined: 'Jan 2026' },
  { id: 2, name: 'EcoVentures Ltd.', industry: 'Manufacturing', manager: 'James Wilson', viewers: 8, uploads: 22, emissions: '3,820 tCO₂e', status: 'active', joined: 'Feb 2026' },
  { id: 3, name: 'Sustain Corp.', industry: 'Retail', manager: 'Maria Garcia', viewers: 5, uploads: 0, emissions: '—', status: 'pending', joined: 'Apr 2026' },
  { id: 4, name: 'CleanAir Systems', industry: 'Engineering', manager: 'Tom Brown', viewers: 20, uploads: 58, emissions: '870 tCO₂e', status: 'active', joined: 'Mar 2026' },
  { id: 5, name: 'NovaTech Solutions', industry: 'SaaS', manager: 'Priya Patel', viewers: 3, uploads: 7, emissions: '210 tCO₂e', status: 'active', joined: 'Apr 2026' },
  { id: 6, name: 'BioGreen Labs', industry: 'Biotech', manager: '—', viewers: 0, uploads: 0, emissions: '—', status: 'onboarding', joined: 'Apr 2026' },
];

const statusVariant: Record<string, 'success' | 'warning' | 'info'> = {
  active: 'success',
  pending: 'warning',
  onboarding: 'info',
};

export default function AdminCompaniesPage() {
  const [search, setSearch] = useState('');

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Companies</h1>
          <p className="text-slate-400 mt-1">All registered client organizations on the platform.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Companies', value: companies.length, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Active', value: companies.filter(c => c.status === 'active').length, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Pending Setup', value: companies.filter(c => c.status !== 'active').length, icon: MoreHorizontal, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Total Viewers', value: companies.reduce((a, c) => a + c.viewers, 0), icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-3`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <DashboardCard title="All Companies" subtitle={`${filtered.length} organizations`}>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or industry..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-700/50">
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Industry</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Manager</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Viewers</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Uploads</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Emissions</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filtered.map(company => (
                <tr key={company.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="font-medium text-white">{company.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-400">{company.industry}</td>
                  <td className="py-3 pr-4 text-slate-300">{company.manager}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Users className="w-3.5 h-3.5 text-slate-500" />{company.viewers}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />{company.uploads}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-300 font-mono text-xs">{company.emissions}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={statusVariant[company.status] ?? 'info'}>{company.status}</Badge>
                  </td>
                  <td className="py-3 text-slate-500 text-xs">{company.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
  );
}
