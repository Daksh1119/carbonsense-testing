'use client';

import { useState } from 'react';
import DashboardCard from '@/components/DashboardCard';
import { Settings, Globe, Mail, Bell, Database, Save, ChevronRight } from 'lucide-react';

export default function AdminSettingsPage() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${value ? 'bg-emerald-500' : 'bg-slate-600'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Platform Settings</h1>
          <p className="text-slate-400 mt-1">Global configuration for the CarbonSense platform.</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          <Save className="w-4 h-4" />
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* General */}
      <DashboardCard title="General" subtitle="Platform identity and URLs">
        <div className="space-y-4">
          {[
            { label: 'Platform Name', value: 'CarbonSense', icon: Globe },
            { label: 'Support Email', value: 'support@carbonsense.io', icon: Mail },
            { label: 'Platform URL', value: 'https://carbonsense.io', icon: Globe },
          ].map(field => (
            <div key={field.label}>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{field.label}</label>
              <div className="relative">
                <field.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  defaultValue={field.value}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Security */}
      <DashboardCard title="Security" subtitle="Auth and API enforcement settings">
        <div className="space-y-4">
          {[
            { label: 'Strict API Authorization', description: 'Enforce org membership and permission checks on all API calls.', value: maintenanceMode, onChange: setMaintenanceMode },
            { label: 'Maintenance Mode', description: 'Redirect all users to a maintenance page. Only admins can access.', value: maintenanceMode, onChange: setMaintenanceMode },
          ].map(setting => (
            <div key={setting.label} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700/30 rounded-lg">
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-medium text-white">{setting.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{setting.description}</p>
              </div>
              <Toggle value={setting.value} onChange={setting.onChange} />
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Notifications */}
      <DashboardCard title="Notifications" subtitle="Platform event alerts">
        <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-white">Email Notifications</p>
              <p className="text-xs text-slate-400">Receive alerts for new manager signups, errors, and approvals.</p>
            </div>
          </div>
          <Toggle value={emailNotifs} onChange={setEmailNotifs} />
        </div>
      </DashboardCard>

      {/* Database */}
      <DashboardCard title="Database" subtitle="Supabase project details">
        <div className="space-y-3">
          {[
            { label: 'Project', value: 'carbonsense (hqfikhpzrxiaafhlobcq)' },
            { label: 'Region', value: 'ap-south-1 (Mumbai)' },
            { label: 'Plan', value: 'Free tier' },
            { label: 'RLS', value: 'Enabled on all 23 tables' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">{item.label}</span>
              </div>
              <span className="text-sm text-slate-200 font-mono">{item.value}</span>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
