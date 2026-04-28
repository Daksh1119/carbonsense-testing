'use client';

import Link from 'next/link';
import { Wind, Eye } from 'lucide-react';

export default function ViewerEmissionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Emissions</h1>
        <p className="text-sm text-slate-400 mt-1">Read-only view of your recent emissions context.</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Wind className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg text-white font-semibold">Employee Emissions Feed</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          This view is read-only. Data entries and uploads can only be performed by manager/admin roles.
        </p>
        <Link href="/viewer/dashboard" className="text-sky-300 text-sm hover:text-sky-200 inline-flex items-center gap-1">
          <Eye className="w-4 h-4" />
          Return to dashboard overview
        </Link>
      </div>
    </div>
  );
}
