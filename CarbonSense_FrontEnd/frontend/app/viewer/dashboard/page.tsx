'use client';

import { useUserStore } from '@/store';
import { Leaf, TrendingDown, BarChart3, Target } from 'lucide-react';

export default function ViewerDashboardPage() {
  const { user } = useUserStore();

  const cards = [
    { title: 'My Carbon Footprint', value: '—', sub: 'tCO2e this period', icon: Leaf, color: 'sky' },
    { title: 'Dept. Average', value: '—', sub: `${user?.department || 'Department'} avg`, icon: BarChart3, color: 'teal' },
    { title: 'Company Total', value: '—', sub: 'organization-wide', icon: TrendingDown, color: 'emerald' },
    { title: 'Reduction Target', value: '—', sub: 'annual goal', icon: Target, color: 'amber' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with viewer badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome, {user?.name || 'Employee'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Your personal carbon insights
          </p>
        </div>
        <span className="px-3 py-1 text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full">
          Viewer Access
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.title} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">{c.title}</span>
              <div className={`p-2 bg-${c.color}-500/10 rounded-lg`}>
                <c.icon className={`w-4 h-4 text-${c.color}-400`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Read-only insights */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-sky-400" />
          Company-Wide Carbon Summary
        </h2>
        <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
          Summary data will appear once emissions are uploaded by your manager
        </div>
      </div>

      <div className="bg-sky-500/5 border border-sky-500/15 rounded-xl p-4">
        <p className="text-sm text-sky-300/80">
          💡 <strong>Tip:</strong> Reduce your footprint by choosing public transport,
          reducing food waste, and optimizing energy usage at your workstation.
        </p>
      </div>
    </div>
  );
}
