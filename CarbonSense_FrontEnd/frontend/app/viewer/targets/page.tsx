'use client';

import { Target } from 'lucide-react';

export default function ViewerTargetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Company Targets</h1>
        <p className="text-sm text-slate-400 mt-1">Progress snapshots toward organization-wide reduction goals.</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg text-white font-semibold">Read-only target board</h2>
        </div>
        <p className="text-sm text-slate-400">
          Viewer accounts can track progress but cannot edit targets, baselines, or milestones.
        </p>
      </div>
    </div>
  );
}
