'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import OTPInput from '@/components/auth/OTPInput';
import { verifyOTP, signInWithOTP, getRoleDashboardPath, type Role } from '@/lib/authHelpers';

function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';
  const role = (params.get('role') || 'admin') as Role;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(30);

  // Countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleComplete = useCallback(async (code: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await verifyOTP(email, code);
      if (!result.success) { setError(result.error || 'Invalid code.'); return; }
      if (result.role && result.role !== role) { setError(`Role mismatch. Expected ${role}.`); return; }
      router.push(getRoleDashboardPath(result.role || role));
    } catch { setError('Verification failed.'); } finally { setLoading(false); }
  }, [email, role, router]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const r = await signInWithOTP(email);
    if (r.success) setResendCooldown(30);
    else setError(r.error || 'Failed to resend.');
  };

  const accentColor = role === 'admin' ? 'emerald' : role === 'manager' ? 'teal' : 'sky';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href={`/login/${role}`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to login
        </Link>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl text-center">
          <div className={`mx-auto w-14 h-14 bg-${accentColor}-500/10 border border-${accentColor}-500/20 rounded-xl flex items-center justify-center mb-5`}>
            <Shield className={`w-6 h-6 text-${accentColor}-400`} />
          </div>

          <h1 className="text-xl font-bold text-white mb-1">Enter Verification Code</h1>
          <p className="text-sm text-slate-400 mb-6">
            We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
          </p>

          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}

          <OTPInput onComplete={handleComplete} disabled={loading} error={error ? '' : undefined} />

          <div className="mt-6">
            <button onClick={handleResend} disabled={resendCooldown > 0} className="text-sm text-slate-400 hover:text-white disabled:cursor-not-allowed transition-colors">
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950"/>}><VerifyContent/></Suspense>;
}
