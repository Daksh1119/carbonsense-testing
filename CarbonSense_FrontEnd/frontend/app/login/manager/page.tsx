'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Eye, EyeOff, Mail, Lock, ArrowLeft, ShieldCheck, Award, CheckCircle } from 'lucide-react';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import ConsentModal from '@/components/auth/ConsentModal';
import {
  signInWithEmail,
  signInWithGoogle,
  sendPasswordReset,
  getRoleDashboardPath,
} from '@/lib/authHelpers';

/**
 * /login/manager — Manager Login Portal
 * Corporate teal/slate palette, trust panel, consent modal gate.
 */
export default function ManagerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signInWithEmail(email, password);
      if (!result.success) { setError(result.error || 'Sign-in failed.'); return; }
      if (result.role !== 'manager') { setError('Access denied. This portal is for manager users only.'); return; }
      setAuthToken(result.session?.access_token ?? null);
      setShowConsent(true);
    } catch { setError('An unexpected error occurred.'); } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    try { await signInWithGoogle('manager'); } catch { setError('Google sign-in failed.'); }
  };

  const handleConsent = async (digitalSignature: string) => {
    setConsentLoading(true);
    try {
      const res = await fetch('/api/auth/record-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ digitalSignature, consentVersion: 'v1.0' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to record consent.');
      }
      // Force session refresh to update JWT metadata
      await supabase.auth.getSession();
      router.push(getRoleDashboardPath('manager'));
    } catch { setError('Failed to record consent. Please try again.'); } finally {
      setConsentLoading(false);
      setShowConsent(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) { setError('Enter your email to reset your password.'); return; }
    const result = await sendPasswordReset(email);
    if (result.success) { setResetSent(true); setError(''); }
    else { setError(result.error || 'Failed to send reset email.'); }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex overflow-hidden">
      {/* Left — Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-teal-500/6 rounded-full blur-3xl animate-[pulse_7s_ease-in-out_infinite]" />
          <div className="absolute bottom-1/3 right-1/3 w-56 h-56 bg-teal-600/5 rounded-full blur-3xl animate-[pulse_9s_ease-in-out_infinite_2s]" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to role selection
          </Link>

          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                <Building2 className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Manager Portal</h1>
                <p className="text-xs text-slate-400">Organization data management</p>
              </div>
            </div>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}
            {resetSent && <div className="mb-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg text-sm text-teal-300">Password reset email sent. Check your inbox.</div>}

            <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Work Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="manager-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your work email address"
                    autoComplete="username"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="manager-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-teal-500 text-white font-semibold text-sm rounded-xl hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</span>
                  : 'Sign in'}
              </button>
            </form>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-slate-700/50" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-slate-700/50" />
            </div>

            <div className="mb-6">
              <GoogleSignInButton onClick={handleGoogleSignIn} />
            </div>

            <div className="text-center">
              <button type="button" onClick={handlePasswordReset} className="text-sm text-slate-400 hover:text-teal-300 transition-colors">
                Forgot password?
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Trust panel (desktop only) */}
      <div className="hidden lg:flex w-96 flex-col justify-center p-10 bg-slate-900/30 border-l border-slate-800/50">
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-white mb-3">Data you can trust</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              CarbonSense is built for organizations that take carbon management seriously. Your data is encrypted at rest and in transit.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: ShieldCheck, label: 'SOC 2 compliant infrastructure' },
              { icon: Award, label: 'ISO 14064 methodology aligned' },
              { icon: CheckCircle, label: 'GDPR-ready data processing' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 rounded-lg">
                  <item.icon className="w-4 h-4 text-teal-400" />
                </div>
                <span className="text-sm text-slate-300">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="p-4 bg-teal-500/5 border border-teal-500/15 rounded-xl">
            <p className="text-xs text-teal-300/80 leading-relaxed">
              &ldquo;CarbonSense gives us the visibility we need to make data-driven decisions about our carbon reduction strategy.&rdquo;
            </p>
            <p className="text-xs text-slate-500 mt-2">— CarbonSense Platform</p>
          </div>
        </div>
      </div>

      {/* Consent Modal */}
      <ConsentModal
        isOpen={showConsent}
        onConsent={handleConsent}
        onClose={() => setShowConsent(false)}
        loading={consentLoading}
      />
    </div>
  );
}
