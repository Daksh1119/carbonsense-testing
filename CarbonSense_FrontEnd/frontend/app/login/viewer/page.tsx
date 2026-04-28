'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye as EyeIcon, EyeOff, Mail, Lock, ArrowLeft, Leaf, UserPlus } from 'lucide-react';
import { signInWithEmail, sendPasswordReset, getRoleDashboardPath } from '@/lib/authHelpers';

export default function ViewerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signInWithEmail(email, password);
      if (!result.success) { setError(result.error || 'Sign-in failed.'); return; }
      if (result.role !== 'viewer') { setError('This portal is for viewer accounts only.'); return; }
      // Approval check happens in ProtectedRoute / dashboard
      router.push(getRoleDashboardPath('viewer'));
    } catch { setError('An unexpected error occurred.'); } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!email) { setError('Enter your email first.'); return; }
    const r = await sendPasswordReset(email);
    if (r.success) { setResetSent(true); setError(''); } else { setError(r.error || 'Failed.'); }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex overflow-hidden">
      {/* Left — Illustration panel (desktop) */}
      <div className="hidden lg:flex w-96 flex-col justify-center items-center p-10 bg-slate-900/30 border-r border-slate-800/50">
        <div className="text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center">
            <Leaf className="w-10 h-10 text-sky-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Your Carbon Insights</h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
            Track your personal and departmental carbon footprint. See how your organization
            is progressing toward its reduction goals.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {['Personal Footprint','Dept. Analytics','Company Targets','Reduction Tips'].map(t=>(
              <div key={t} className="px-3 py-2 bg-sky-500/5 border border-sky-500/15 rounded-lg text-xs text-sky-300 text-center">{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-sky-500/6 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to role selection
          </Link>

          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                <EyeIcon className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Viewer Portal</h1>
                <p className="text-xs text-slate-400">Employee read-only access</p>
              </div>
            </div>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}
            {resetSent && <div className="mb-4 p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sm text-sky-300">Password reset email sent.</div>}

            <form onSubmit={handleLogin} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input id="viewer-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="employee@company.com" required className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input id="viewer-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required className="w-full pl-10 pr-11 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30" />
                  <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword?<EyeOff className="w-4 h-4"/>:<EyeIcon className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-sky-500 text-white font-semibold text-sm rounded-xl hover:bg-sky-400 transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 active:scale-[0.98]">
                {loading?<span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Signing in...</span>:'Sign in'}
              </button>
            </form>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-slate-700/50"/><span className="text-xs text-slate-500">NEW HERE?</span><div className="flex-1 h-px bg-slate-700/50"/>
            </div>

            <Link href="/signup/employee" className="flex items-center justify-center gap-2 w-full py-2.5 text-sm text-sky-300 border border-sky-500/30 rounded-xl hover:bg-sky-500/10 transition-all">
              <UserPlus className="w-4 h-4"/>Create Employee Account
            </Link>

            <div className="text-center mt-4">
              <button type="button" onClick={handleReset} className="text-sm text-slate-400 hover:text-sky-300 transition-colors">Forgot password?</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
