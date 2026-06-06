'use client';

import DashboardCard from '@/components/DashboardCard';
import { Activity, Database, Zap, Shield, Server, Wifi, CheckCircle, AlertTriangle } from 'lucide-react';

const services = [
  { name: 'Auth Service (Supabase)', status: 'operational', latency: '48ms', uptime: '99.98%', icon: Shield },
  { name: 'Database (PostgreSQL)', status: 'operational', latency: '12ms', uptime: '99.99%', icon: Database },
  { name: 'ML API (FastAPI)', status: 'operational', latency: '142ms', uptime: '99.7%', icon: Zap },
  { name: 'Frontend (Next.js)', status: 'operational', latency: '220ms', uptime: '99.9%', icon: Server },
  { name: 'OCR Service', status: 'degraded', latency: '890ms', uptime: '97.2%', icon: Activity },
  { name: 'Storage (Supabase)', status: 'operational', latency: '65ms', uptime: '99.95%', icon: Wifi },
];

const metrics = [
  { label: 'API Requests Today', value: '14,832', delta: '+12%', color: 'text-emerald-400' },
  { label: 'Active Sessions', value: '37', delta: '+4', color: 'text-blue-400' },
  { label: 'DB Load', value: '23%', delta: '-3%', color: 'text-teal-400' },
  { label: 'Error Rate', value: '0.08%', delta: '-0.02%', color: 'text-emerald-400' },
];

const recentErrors = [
  { time: '17:42', service: 'OCR Service', message: 'Timeout on bulk receipt processing (3 files)', level: 'warning' },
  { time: '14:11', service: 'ML API', message: 'LLM provider rate limit hit — fallback triggered', level: 'warning' },
  { time: '09:05', service: 'Auth', message: 'Failed login attempt from unrecognized IP', level: 'info' },
];

export default function AdminHealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Platform Health</h1>
        <p className="text-slate-400 mt-1">Real-time status of all CarbonSense platform services.</p>
      </div>

      {/* Overall status banner */}
      <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-300">All core systems operational</p>
          <p className="text-xs text-slate-400 mt-0.5">1 service degraded · Last checked: just now</p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-2">{m.label}</p>
            <p className="text-2xl font-bold text-white">{m.value}</p>
            <p className={`text-xs font-medium mt-1 ${m.color}`}>{m.delta} vs yesterday</p>
          </div>
        ))}
      </div>

      {/* Services */}
      <DashboardCard title="Service Status" subtitle="Last 24 hours">
        <div className="space-y-3">
          {services.map(service => (
            <div key={service.name} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${service.status === 'operational' ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                  <service.icon className={`w-4 h-4 ${service.status === 'operational' ? 'text-emerald-400' : 'text-amber-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{service.name}</p>
                  <p className="text-xs text-slate-400">Uptime: {service.uptime}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-slate-400">{service.latency}</span>
                {service.status === 'operational'
                  ? <div className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle className="w-3.5 h-3.5" />Operational</div>
                  : <div className="flex items-center gap-1.5 text-xs text-amber-400"><AlertTriangle className="w-3.5 h-3.5" />Degraded</div>
                }
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Recent errors */}
      <DashboardCard title="Recent Events" subtitle="Last 24 hours">
        <div className="space-y-3">
          {recentErrors.map((err, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${err.level === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-slate-300">{err.service}</span>
                  <span className="text-xs text-slate-500">{err.time}</span>
                </div>
                <p className="text-xs text-slate-400">{err.message}</p>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
