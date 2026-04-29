'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy /manager route — redirects to /dashboard.
 * Manager now owns the /(dashboard) route group directly.
 */
export default function ManagerRedirectLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
      Redirecting to dashboard...
    </div>
  );
}
