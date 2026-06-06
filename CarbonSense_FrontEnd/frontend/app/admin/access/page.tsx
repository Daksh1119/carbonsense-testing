'use client';

import { useState } from 'react';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import { Shield, Users, Building2, Key, Lock, Eye, EyeOff } from 'lucide-react';

const roles = [
  {
    role: 'Platform Admin',
    description: 'CarbonSense internal team. Full platform visibility and control.',
    color: 'emerald',
    permissions: ['View all organizations', 'Manage companies', 'Approve managers', 'Platform settings', 'View all data', 'Access control'],
  },
  {
    role: 'Manager',
    description: 'Client company carbon program lead. Full CRUD on own organization.',
    color: 'teal',
    permissions: ['Data ingestion', 'Team management', 'Approve viewers', 'Compliance tracking', 'Recommendations', 'Analytics', 'TEME', 'Policy intelligence'],
  },
  {
    role: 'Viewer',
    description: 'Client company employee. Read-only access to own organization dashboards.',
    color: 'sky',
    permissions: ['View dashboards', 'View emissions', 'View reports', 'View targets', 'Personal profile'],
  },
];

const recentActivity = [
  { time: '17:30', user: 'admin@carbonsense.test', action: 'Approved manager signup — Maria Garcia (Sustain Corp.)', type: 'approve' },
  { time: '15:12', user: 'admin@carbonsense.test', action: 'Updated platform settings — max upload size', type: 'update' },
  { time: '11:45', user: 'admin@carbonsense.test', action: 'Rejected viewer request — spam flag', type: 'reject' },
  { time: '09:02', user: 'admin@carbonsense.test', action: 'Added new company — BioGreen Labs', type: 'create' },
];

const typeColor: Record<string, string> = {
  approve: 'text-emerald-400',
  update: 'text-blue-400',
  reject: 'text-red-400',
  create: 'text-purple-400',
};

export default function AdminAccessPage() {
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Access Control</h1>
        <p className="text-slate-400 mt-1">Role definitions, permissions matrix, and admin audit log.</p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {roles.map(r => (
          <div key={r.role} className={`bg-slate-800 border border-slate-700 rounded-xl p-5`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg bg-${r.color}-500/10`}>
                <Shield className={`w-4 h-4 text-${r.color}-400`} />
              </div>
              <div>
                <p className="font-bold text-white text-sm">{r.role}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">{r.description}</p>
            <div className="space-y-1.5">
              {r.permissions.map(p => (
                <div key={p} className="flex items-center gap-2 text-xs text-slate-300">
                  <div className={`w-1.5 h-1.5 rounded-full bg-${r.color}-400 flex-shrink-0`} />
                  {p}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Service Role Key */}
      <DashboardCard title="Service Role Key" subtitle="Used by API routes to bypass RLS">
        <div className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
          <Key className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex-1 font-mono text-xs text-slate-300 truncate">
            {showToken ? 'SUPABASE_SERVICE_ROLE_KEY set in .env' : '••••••••••••••••••••••••••••••••••'}
          </div>
          <button onClick={() => setShowToken(!showToken)} className="text-slate-500 hover:text-slate-300 transition-colors">
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <Lock className="w-4 h-4 text-slate-600" />
        </div>
        <p className="text-xs text-slate-500 mt-2">Never expose this key in client-side code. Used only in Next.js route handlers and FastAPI service.</p>
      </DashboardCard>

      {/* Audit log */}
      <DashboardCard title="Admin Audit Log" subtitle="Recent platform-level actions">
        <div className="space-y-3">
          {recentActivity.map((activity, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
              <div className="text-xs text-slate-500 font-mono w-12 flex-shrink-0 pt-0.5">{activity.time}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold mb-0.5 ${typeColor[activity.type]}`}>{activity.action}</p>
                <p className="text-xs text-slate-500">{activity.user}</p>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
