'use client';

import { Clock, Mail, LogOut } from 'lucide-react';
import { useUserStore } from '@/store';

/**
 * Shown to viewer-role users whose accounts are pending manager approval.
 */
export default function ApprovalPendingScreen() {
  const { user, logout } = useUserStore();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        {/* Animated clock icon */}
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 bg-amber-500/10 rounded-full animate-ping" />
          <div className="relative flex items-center justify-center w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          Account Pending Approval
        </h1>

        <p className="text-slate-400 mb-6 leading-relaxed">
          Your account is pending manager approval. You&apos;ll receive an email
          notification once your access has been granted.
        </p>

        {/* Status card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 mb-6 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Status</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Pending Review
            </span>
          </div>
          {user?.email && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Email</span>
              <span className="text-sm text-slate-300">{user.email}</span>
            </div>
          )}
          {user?.organization && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Organization</span>
              <span className="text-sm text-slate-300">{user.organization}</span>
            </div>
          )}
        </div>

        {/* Help text */}
        <p className="text-sm text-slate-500 mb-6 flex items-center justify-center gap-1.5">
          <Mail className="w-4 h-4" />
          Check your email for approval updates
        </p>

        {/* Logout */}
        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-800 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
