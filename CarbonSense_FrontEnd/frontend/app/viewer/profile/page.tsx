'use client';

import { User } from 'lucide-react';
import { useUserStore } from '@/store';

export default function ViewerProfilePage() {
  const { user } = useUserStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-sm text-slate-400 mt-1">Viewer identity and organization details.</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg text-white font-semibold">Account Information</h2>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <dt className="text-slate-500">Name</dt>
            <dd className="text-slate-200">{user?.name || '—'}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-200">{user?.email || '—'}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <dt className="text-slate-500">Department</dt>
            <dd className="text-slate-200">{user?.department || '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Role</dt>
            <dd className="text-slate-200 capitalize">{user?.role || 'viewer'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
