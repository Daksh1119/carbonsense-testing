'use client';

import { useState } from 'react';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import { Users, Building2, Search, CheckCircle, Clock, XCircle, Mail } from 'lucide-react';

const managers = [
  { id: 1, name: 'Sarah Chen', email: 'sarah@greentech.com', company: 'GreenTech Inc.', viewers: 12, uploads: 34, consentSigned: true, status: 'active', joined: 'Jan 2026' },
  { id: 2, name: 'James Wilson', email: 'james@ecoventures.com', company: 'EcoVentures Ltd.', viewers: 8, uploads: 22, consentSigned: true, status: 'active', joined: 'Feb 2026' },
  { id: 3, name: 'Maria Garcia', email: 'maria@sustaincorp.com', company: 'Sustain Corp.', viewers: 5, uploads: 0, consentSigned: false, status: 'pending', joined: 'Apr 2026' },
  { id: 4, name: 'Tom Brown', email: 'tom@cleanair.com', company: 'CleanAir Systems', viewers: 20, uploads: 58, consentSigned: true, status: 'active', joined: 'Mar 2026' },
  { id: 5, name: 'Priya Patel', email: 'priya@novatech.com', company: 'NovaTech Solutions', viewers: 3, uploads: 7, consentSigned: true, status: 'active', joined: 'Apr 2026' },
];

export default function AdminManagersPage() {
  const [search, setSearch] = useState('');

  const filtered = managers.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.company.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Managers</h1>
        <p className="text-slate-400 mt-1">All company carbon program leads registered on the platform.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Managers', value: managers.length, icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
          { label: 'Consent Signed', value: managers.filter(m => m.consentSigned).length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Pending Consent', value: managers.filter(m => !m.consentSigned).length, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
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

      <DashboardCard title="All Managers" subtitle={`${filtered.length} registered`}>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="space-y-3">
          {filtered.map(manager => (
            <div key={manager.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-teal-400">{manager.name[0]}</span>
                </div>
                <div>
                  <p className="font-semibold text-white">{manager.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    <Mail className="w-3 h-3" />{manager.email}
                  </div>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs">{manager.company}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">{manager.viewers}</p>
                  <p className="text-xs text-slate-500">viewers</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">{manager.uploads}</p>
                  <p className="text-xs text-slate-500">uploads</p>
                </div>
                <div>
                  {manager.consentSigned
                    ? <div className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" />Consent signed</div>
                    : <div className="flex items-center gap-1 text-amber-400 text-xs"><Clock className="w-3.5 h-3.5" />Awaiting consent</div>
                  }
                </div>
                <Badge variant={manager.status === 'active' ? 'success' : 'warning'}>{manager.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
