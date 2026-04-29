'use client';

import { useState } from 'react';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import { Building2, Users, Activity, Shield, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';

/**
 * /admin/dashboard — Platform Admin Overview
 * Shows company list, manager list, platform health, usage metrics.
 * This is for the CarbonSense internal team, NOT client companies.
 */
export default function PlatformAdminDashboard() {
  // Placeholder data — will be replaced with real API calls
  const [companies] = useState([
    { id: 1, name: 'GreenTech Inc.', manager: 'Sarah Chen', viewers: 12, status: 'active', lastUpload: '2 hours ago' },
    { id: 2, name: 'EcoVentures Ltd.', manager: 'James Wilson', viewers: 8, status: 'active', lastUpload: '1 day ago' },
    { id: 3, name: 'Sustain Corp.', manager: 'Maria Garcia', viewers: 5, status: 'pending', lastUpload: 'Never' },
    { id: 4, name: 'CleanAir Systems', manager: 'Tom Brown', viewers: 20, status: 'active', lastUpload: '3 hours ago' },
  ]);

  const stats = [
    { label: 'Total Companies', value: '24', icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Managers', value: '31', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Total Viewers', value: '187', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Platform Uptime', value: '99.9%', icon: Activity, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  ];

  const pendingApprovals = [
    { id: 1, type: 'Manager Signup', name: 'Alex Rivera', company: 'NovaTech', submitted: '2 hours ago' },
    { id: 2, type: 'Company Registration', name: 'BioGreen Labs', company: 'BioGreen Labs', submitted: '5 hours ago' },
    { id: 3, type: 'Viewer Request', name: 'Emily Park', company: 'GreenTech Inc.', submitted: '1 day ago' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Platform Overview</h1>
        <p className="text-slate-400 mt-1">
          CarbonSense internal operations — manage companies, managers, and platform health.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companies Table */}
        <div className="lg:col-span-2">
          <DashboardCard title="Companies" subtitle={`${companies.length} registered`}>
            <div className="space-y-3">
              {companies.map((company) => (
                <div key={company.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Building2 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{company.name}</p>
                      <p className="text-xs text-slate-400">Manager: {company.manager} · {company.viewers} viewers</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{company.lastUpload}</span>
                    <Badge variant={company.status === 'active' ? 'success' : 'warning'}>
                      {company.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        {/* Pending Approvals */}
        <div>
          <DashboardCard title="Pending Approvals" subtitle={`${pendingApprovals.length} waiting`}>
            <div className="space-y-3">
              {pendingApprovals.map((item) => (
                <div key={item.id} className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300">{item.type}</span>
                  </div>
                  <p className="text-sm font-medium text-white">{item.name}</p>
                  <p className="text-xs text-slate-400">{item.company} · {item.submitted}</p>
                  <div className="flex gap-2 mt-2">
                    <button className="px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors">
                      <CheckCircle className="w-3 h-3 inline mr-1" />Approve
                    </button>
                    <button className="px-3 py-1 text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-600/50 transition-colors">
                      <Clock className="w-3 h-3 inline mr-1" />Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Platform Health */}
      <DashboardCard title="Platform Health" subtitle="Last 24 hours">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'API Response Time', value: '142ms', status: 'healthy' },
            { label: 'Database Load', value: '23%', status: 'healthy' },
            { label: 'Auth Service', value: 'Operational', status: 'healthy' },
          ].map((metric) => (
            <div key={metric.label} className="p-4 bg-slate-900/50 border border-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">{metric.label}</span>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-lg font-bold text-white">{metric.value}</p>
              <p className="text-xs text-emerald-400 mt-1 capitalize">{metric.status}</p>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
