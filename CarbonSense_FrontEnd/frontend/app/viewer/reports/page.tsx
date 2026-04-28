'use client';

import { FileBarChart } from 'lucide-react';

export default function ViewerReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-sm text-slate-400 mt-1">Read-only access to published carbon reports.</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <FileBarChart className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg text-white font-semibold">Published reports</h2>
        </div>
        <p className="text-sm text-slate-400">
          You can review generated reports here. Export and report-generation permissions are restricted to manager/admin roles.
        </p>
      </div>
    </div>
  );
}
