'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  Briefcase,
  Globe,
  Award,
} from 'lucide-react';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { signInWithGoogle } from '@/lib/authHelpers';

const INDUSTRIES = [
  'Energy & Utilities',
  'Manufacturing & Industrial',
  'Technology & Software',
  'Logistics & Transportation',
  'Finance & Real Estate',
  'Healthcare & Pharmaceuticals',
  'Retail & Consumer Goods',
  'Other',
];

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phone: string;
  organizationName: string;
  industry: string;
  country: string;
}

const INITIAL: FormData = {
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  jobTitle: 'Sustainability Manager',
  phone: '',
  organizationName: '',
  industry: 'Technology & Software',
  country: 'India',
};

function ManagerSignupContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...INITIAL, email: emailParam });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (emailParam && !form.email) {
      setForm((prev) => ({ ...prev, email: emailParam }));
    }
  }, [emailParam, form.email]);

  const set = (k: keyof FormData, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const canNext = (): boolean => {
    if (step === 1) {
      return !!(
        form.email &&
        form.password &&
        form.confirmPassword &&
        form.password === form.confirmPassword &&
        form.password.length >= 8
      );
    }
    if (step === 2) {
      return !!(form.firstName && form.lastName);
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/manager-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Manager signup failed.');
        return;
      }
      setDone(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch {
      setError('Google sign-up failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto w-16 h-16 bg-teal-500/10 border border-teal-500/20 rounded-full flex items-center justify-center mb-5">
            <CheckCircle className="w-8 h-8 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Manager Setup Complete!</h1>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            Your Manager account has been created and pre-approved for your organization. Log in now to access the Manager Dashboard.
          </p>
          <Link
            href="/login/manager"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm bg-teal-500 text-slate-950 hover:bg-teal-400 rounded-xl transition-all font-bold shadow-lg shadow-teal-500/20"
          >
            Go to Manager Login →
          </Link>
        </div>
      </div>
    );
  }

  const inputCls =
    'w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30';
  const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-teal-500/6 rounded-full blur-3xl animate-[pulse_7s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <Link
          href="/login/manager"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Manager Login
        </Link>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl">
              <Building2 className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Manager Registration</h1>
              <p className="text-xs text-teal-400 font-medium">Setup Manager Profile & Organization</p>
            </div>
          </div>

          <p className="text-sm text-slate-400 mb-6">Step {step} of 3</p>

          {/* Progress */}
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  s <= step ? 'bg-teal-500' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Step 1 — Account Credentials */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-teal-400 mb-2">
                <Mail className="w-4 h-4" />
                <span className="text-sm font-semibold">Account Credentials</span>
              </div>
              <GoogleSignInButton
                onClick={handleGoogleSignup}
                disabled={googleLoading}
                label={googleLoading ? 'Redirecting to Google...' : 'Sign up with Google'}
              />
              <p className="text-xs text-slate-500">
                Or fill in your credentials below to register as a Manager.
              </p>

              <div>
                <label className={labelCls}>Manager Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    className={`${inputCls} pl-10`}
                    placeholder="manager@company.com"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Password (min 8 chars)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    className={`${inputCls} pl-10`}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                    className={`${inputCls} pl-10`}
                    placeholder="••••••••"
                  />
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Manager Profile */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-teal-400 mb-2">
                <User className="w-4 h-4" />
                <span className="text-sm font-semibold">Manager Profile</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    className={inputCls}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    className={inputCls}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Job Title / Role</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(e) => set('jobTitle', e.target.value)}
                    className={`${inputCls} pl-10`}
                    placeholder="e.g. Sustainability Lead / ESG Manager"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Phone Number (Optional)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    className={`${inputCls} pl-10`}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Organization Setup */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-teal-400 mb-2">
                <Building2 className="w-4 h-4" />
                <span className="text-sm font-semibold">Organization Setup</span>
              </div>

              <div>
                <label className={labelCls}>Organization Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={form.organizationName}
                    onChange={(e) => set('organizationName', e.target.value)}
                    className={`${inputCls} pl-10`}
                    placeholder="e.g. Daksh Enterprises"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Industry Sector</label>
                <select
                  value={form.industry}
                  onChange={(e) => set('industry', e.target.value)}
                  className={inputCls}
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind} className="bg-slate-900 text-white">
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Country / Region</label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => set('country', e.target.value)}
                    className={`${inputCls} pl-10`}
                    placeholder="e.g. India"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                disabled={!canNext()}
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-all disabled:opacity-40"
              >
                {loading ? 'Creating Manager Account...' : 'Complete Registration'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManagerSignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading signup...</div>}>
      <ManagerSignupContent />
    </Suspense>
  );
}
