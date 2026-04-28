'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Leaf, Shield, Eye, EyeOff, Mail, Lock, ArrowLeft, Fingerprint } from 'lucide-react';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import {
  signInWithEmail,
  signInWithGoogle,
  signInWithOTP,
  sendPasswordReset,
  getRoleDashboardPath,
} from '@/lib/authHelpers';

/**
 * /login/admin — Admin Login Portal
 * Dark professional, slate/emerald palette, terminal-esque accents.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signInWithEmail(email, password);
      if (!result.success) {
        setError(result.error || 'Sign-in failed.');
        return;
      }

      if (result.role && result.role !== 'admin') {
        setError('Access denied. This portal is for admin users only.');
        return;
      }

      // AuthProvider onAuthStateChange will sync the profile.
      // Redirect immediately — no extra round trip needed.
      router.push('/dashboard');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch {
      setError('Google sign-in failed.');
    }
  };

  const handleOTP = async () => {
    if (!email) {
      setError('Enter your email to receive a one-time code.');
      return;
    }
    setOtpLoading(true);
    setError('');

    try {
      const result = await signInWithOTP(email);
      if (!result.success) {
        setError(result.error || 'Failed to send OTP.');
        return;
      }
      router.push(`/auth/verify?email=${encodeURIComponent(email)}&role=admin`);
    } catch {
      setError('Failed to send one-time code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Enter your email to reset your password.');
      return;
    }
    const result = await sendPasswordReset(email);
    if (result.success) {
      setResetSent(true);
      setError('');
    } else {
      setError(result.error || 'Failed to send reset email.');
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex items-center justify-center p-6 overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-20 left-10 w-60 h-60 bg-emerald-600/6 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite_2s]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back link */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to role selection
        </Link>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Portal</h1>
              <p className="text-xs text-slate-400">Elevated access • MFA enabled</p>
            </div>
          </div>

          {/* MFA Badge */}
          <div className="flex items-center gap-2 px-3 py-2 mb-6 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-300">Multi-factor authentication available</span>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
          {resetSent && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-300">
              Password reset email sent. Check your inbox.
            </div>
          )}

          {/* Email + Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@carbonsense.dev"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-500 text-white font-semibold text-sm rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-700/50" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-700/50" />
          </div>

          {/* Google Sign-In */}
          <div className="space-y-3 mb-6">
            <GoogleSignInButton onClick={handleGoogleSignIn} />

            {/* OTP Button */}
            <button
              type="button"
              onClick={handleOTP}
              disabled={otpLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-slate-300 border border-slate-600/50 rounded-xl hover:bg-slate-800/50 hover:text-white transition-all disabled:opacity-50"
            >
              <Fingerprint className="w-4 h-4" />
              {otpLoading ? 'Sending code...' : 'Send One-Time Code'}
            </button>
          </div>

          {/* Forgot password */}
          <div className="text-center">
            <button
              type="button"
              onClick={handlePasswordReset}
              className="text-sm text-slate-400 hover:text-emerald-300 transition-colors"
            >
              Forgot password?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
