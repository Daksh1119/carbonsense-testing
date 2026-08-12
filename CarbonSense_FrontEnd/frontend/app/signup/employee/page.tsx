'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle, User, Building2, FileText, Mail, Lock, Phone, Briefcase, Hash } from 'lucide-react';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { signInWithGoogle } from '@/lib/authHelpers';

const DEPARTMENTS = ['Engineering','Operations','Finance','HR','Marketing','Sales','Legal','Procurement','Facilities','Other'];

interface FormData {
  email:string; password:string; confirmPassword:string;
  firstName:string; lastName:string; jobTitle:string; department:string; employeeId:string; phone:string;
  organizationName:string; organizationId:string; country:string; managerEmail:string;
}

const INITIAL:FormData = {email:'',password:'',confirmPassword:'',firstName:'',lastName:'',jobTitle:'',department:'',employeeId:'',phone:'',organizationName:'',organizationId:'',country:'',managerEmail:''};

export default function EmployeeSignupPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (k:keyof FormData,v:string)=>setForm(p=>({...p,[k]:v}));

  const canNext = ():boolean => {
    if(step===1) return !!(form.email && form.password && form.confirmPassword && form.password===form.confirmPassword && form.password.length>=8);
    if(step===2) return !!(form.firstName && form.lastName);
    if(step===3) return !!(form.managerEmail);
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/employee-signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const data = await res.json();
      if(!res.ok) { setError(data.error||'Signup failed.'); return; }
      setDone(true);
    } catch { setError('An unexpected error occurred.'); } finally { setLoading(false); }
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

  if(done) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-5">
          <CheckCircle className="w-8 h-8 text-emerald-400"/>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Registration Submitted</h1>
        <p className="text-slate-400 mb-6 text-sm leading-relaxed">Your manager ({form.managerEmail}) will review and approve your account. You&apos;ll receive an email notification once approved.</p>
        <Link href="/login/viewer" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-sky-500 text-white rounded-xl hover:bg-sky-400 transition-all font-semibold">Back to Login</Link>
      </div>
    </div>
  );

  const inputCls = "w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30";
  const labelCls = "block text-sm font-medium text-slate-300 mb-1.5";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite]"/>
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <Link href="/login/viewer" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"><ArrowLeft className="w-4 h-4"/>Back to Viewer Login</Link>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-1">Employee Registration</h1>
          <p className="text-sm text-slate-400 mb-6">Step {step} of 4</p>

          {/* Progress */}
          <div className="flex gap-1.5 mb-6">{[1,2,3,4].map(s=>(<div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s<=step?'bg-sky-500':'bg-slate-700'}`}/>))}</div>

          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}

          {/* Step 1 — Credentials */}
          {step===1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sky-400 mb-2"><Mail className="w-4 h-4"/><span className="text-sm font-semibold">Account Credentials</span></div>
              <GoogleSignInButton
                onClick={handleGoogleSignup}
                disabled={googleLoading}
                label={googleLoading ? 'Redirecting to Google...' : 'Sign up with Google'}
              />
              <p className="text-xs text-slate-500">Google sign-up creates a pending viewer account and continues via OAuth callback.</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-700/50" />
                <span className="text-[11px] uppercase tracking-wider text-slate-500">or use email</span>
                <div className="flex-1 h-px bg-slate-700/50" />
              </div>
              <div><label className={labelCls}>Work Email</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="Enter your work email address" autoComplete="username" className={inputCls}/></div>
              <div><label className={labelCls}>Password (min 8 characters)</label><input type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Enter password (min 8 characters)" autoComplete="new-password" className={inputCls}/></div>
              <div><label className={labelCls}>Confirm Password</label><input type="password" value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} placeholder="Re-enter password to confirm" autoComplete="new-password" className={inputCls}/>
                {form.confirmPassword && form.password!==form.confirmPassword && <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>}
              </div>
            </div>
          )}

          {/* Step 2 — Personal */}
          {step===2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sky-400 mb-2"><User className="w-4 h-4"/><span className="text-sm font-semibold">Personal Details</span></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>First Name *</label><input value={form.firstName} onChange={e=>set('firstName',e.target.value)} placeholder="Jane" className={inputCls}/></div>
                <div><label className={labelCls}>Last Name *</label><input value={form.lastName} onChange={e=>set('lastName',e.target.value)} placeholder="Doe" className={inputCls}/></div>
              </div>
              <div><label className={labelCls}>Job Title</label><input value={form.jobTitle} onChange={e=>set('jobTitle',e.target.value)} placeholder="Software Engineer" className={inputCls}/></div>
              <div><label className={labelCls}>Department</label><select value={form.department} onChange={e=>set('department',e.target.value)} className={inputCls}><option value="">Select...</option>{DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Employee ID</label><input value={form.employeeId} onChange={e=>set('employeeId',e.target.value)} placeholder="EMP-001" className={inputCls}/></div>
                <div><label className={labelCls}>Phone</label><input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91..." className={inputCls}/></div>
              </div>
            </div>
          )}

          {/* Step 3 — Org */}
          {step===3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sky-400 mb-2"><Building2 className="w-4 h-4"/><span className="text-sm font-semibold">Organization Details</span></div>
              <div><label className={labelCls}>Organization Name</label><input value={form.organizationName} onChange={e=>set('organizationName',e.target.value)} placeholder="Acme Corp" className={inputCls}/></div>
              <div><label className={labelCls}>Organization ID / Reg Number</label><input value={form.organizationId} onChange={e=>set('organizationId',e.target.value)} placeholder="Optional" className={inputCls}/></div>
              <div><label className={labelCls}>Country / Region</label><input value={form.country} onChange={e=>set('country',e.target.value)} placeholder="India" className={inputCls}/></div>
              <div><label className={labelCls}>Manager Email *</label><input type="email" value={form.managerEmail} onChange={e=>set('managerEmail',e.target.value)} placeholder="manager@company.com" className={inputCls}/><p className="text-xs text-slate-500 mt-1">Your manager will be notified to approve your account.</p></div>
            </div>
          )}

          {/* Step 4 — Review */}
          {step===4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sky-400 mb-2"><FileText className="w-4 h-4"/><span className="text-sm font-semibold">Review & Submit</span></div>
              <div className="space-y-2 text-sm">
                {[['Email',form.email],['Name',`${form.firstName} ${form.lastName}`],['Job Title',form.jobTitle||'—'],['Department',form.department||'—'],['Organization',form.organizationName||'—'],['Manager',form.managerEmail]].map(([l,v])=>(
                  <div key={l as string} className="flex justify-between py-2 border-b border-slate-800"><span className="text-slate-500">{l}</span><span className="text-slate-200">{v}</span></div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            {step>1?<button onClick={()=>setStep(s=>s-1)} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-xl hover:bg-slate-800 transition-all"><ArrowLeft className="w-4 h-4 inline mr-1"/>Back</button>:<div/>}
            {step<4?<button onClick={()=>setStep(s=>s+1)} disabled={!canNext()} className="px-5 py-2 text-sm font-semibold bg-sky-500 text-white rounded-xl hover:bg-sky-400 disabled:opacity-40 transition-all">Next<ArrowRight className="w-4 h-4 inline ml-1"/></button>
            :<button onClick={handleSubmit} disabled={loading} className="px-5 py-2 text-sm font-semibold bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-all">{loading?'Submitting...':'Submit for Approval'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
