'use client';

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import RolePortalCard from '@/components/auth/RolePortalCard';
import { useUserStore } from '@/store';
import { getRoleDashboardPath } from '@/lib/authHelpers';
import { useRouter } from 'next/navigation';
import './landing.css';

/**
 * CarbonSense Landing Page
 * Two-section dark-themed landing with smooth fade scroll transitions:
 *   Section 1: Full-viewport hero with forest background, navbar, headline, stats
 *   Section 2: Existing portal selection page (RolePortalCard) ΓÇö fades in on scroll
 */
export default function LandingPage() {
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { isAuthenticated, user } = useUserStore();

  // If already authenticated, redirect to role dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      router.push(getRoleDashboardPath(user.role));
    }
  }, [isAuthenticated, user, router]);

  /* ΓöÇΓöÇ Smooth scroll to page 2 ΓöÇΓöÇ */
  const scrollToPortals = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const scrollRoot = document.getElementById('landing-scroll-root');
    if (scrollRoot) {
      window.scrollTo({
        top: scrollRoot.scrollHeight - window.innerHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  /* ΓöÇΓöÇ Scroll handler ΓÇö swipe-up + fade ΓöÇΓöÇ */
  const onScroll = useCallback(() => {
    const scrollRoot = document.getElementById('landing-scroll-root');
    if (!scrollRoot) return;
    const maxScroll = scrollRoot.scrollHeight - window.innerHeight;
    const raw = window.scrollY / maxScroll;
    const t = Math.max(0, Math.min(1, raw));

    const page1 = page1Ref.current;
    const page2 = page2Ref.current;

    if (!page1 || !page2) return;

    /* PAGE 1 ΓÇö swipe up + smooth fade out */
    const swipeEnd = 0.6;
    const fadeOutStart = 0.15;
    const fadeOutEnd = 0.55;
    if (t <= 0) {
      page1.style.opacity = '1';
      page1.style.transform = 'translateY(0)';
      page1.style.pointerEvents = 'auto';
    } else if (t >= swipeEnd) {
      page1.style.opacity = '0';
      page1.style.transform = 'translateY(-25%)';
      page1.style.pointerEvents = 'none';
    } else {
      const swipeProgress = t / swipeEnd;
      page1.style.transform = `translateY(${-swipeProgress * 25}%)`;
      /* Fade starts later than swipe so movement is visible first */
      if (t < fadeOutStart) {
        page1.style.opacity = '1';
        page1.style.pointerEvents = 'auto';
      } else if (t >= fadeOutEnd) {
        page1.style.opacity = '0';
        page1.style.pointerEvents = 'none';
      } else {
        const fadeProgress = (t - fadeOutStart) / (fadeOutEnd - fadeOutStart);
        page1.style.opacity = String(1 - fadeProgress);
        page1.style.pointerEvents = fadeProgress > 0.6 ? 'none' : 'auto';
      }
    }

    /* PAGE 2 ΓÇö swipe up from below + smooth fade in */
    const p2SwipeStart = 0.3;
    const p2End = 0.8;
    const p2FadeStart = 0.35;
    const p2FadeEnd = 0.75;
    if (t <= p2SwipeStart) {
      page2.style.opacity = '0';
      page2.style.transform = 'translateY(20%)';
      page2.style.pointerEvents = 'none';
    } else if (t >= p2End) {
      page2.style.opacity = '1';
      page2.style.transform = 'translateY(0)';
      page2.style.pointerEvents = 'auto';
    } else {
      const swipeP = (t - p2SwipeStart) / (p2End - p2SwipeStart);
      page2.style.transform = `translateY(${(1 - swipeP) * 20}%)`;
      /* Fade in slightly after swipe begins */
      if (t < p2FadeStart) {
        page2.style.opacity = '0';
        page2.style.pointerEvents = 'none';
      } else if (t >= p2FadeEnd) {
        page2.style.opacity = '1';
        page2.style.pointerEvents = 'auto';
      } else {
        const fadeP = (t - p2FadeStart) / (p2FadeEnd - p2FadeStart);
        page2.style.opacity = String(fadeP);
        page2.style.pointerEvents = fadeP > 0.5 ? 'auto' : 'none';
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [onScroll]);

  return (
    <div id="landing-scroll-root" className="landing-scroll-root">
      <div className="landing-stage">

        {/* ΓòÉΓòÉΓòÉ PAGE 1 ΓÇö HERO ΓòÉΓòÉΓòÉ */}
        <div ref={page1Ref} className="landing-page1">
          {/* Background image layer */}
          <div className="landing-bg-image" />
          {/* Dark overlay for readability */}
          <div className="landing-bg-overlay" />

          {/* Navbar */}
          <nav className="landing-nav">
            <div className="landing-nav-logo">
              <div className="landing-nav-logo-icon">
                <Leaf className="w-[18px] h-[18px] text-[#00D4A1]" />
              </div>
              CarbonSense
            </div>
            <button onClick={scrollToPortals} className="landing-nav-signin">
              Sign In →
            </button>
          </nav>

          {/* Hero content */}
          <div className="landing-hero">
            <h1 className="landing-h1">
              Carbon Footprint Monitoring &amp;<br />
              <span className="landing-accent">Intelligent Decision Support</span> for Emission Reduction.
            </h1>

            <p className="landing-subline">
              Real-time insights. Science-backed reporting. Zero greenwashing.
            </p>

            <div className="landing-cta-group">
              <button onClick={scrollToPortals} className="landing-btn-primary">
                Get Started
                <span className="landing-btn-arrow">→</span>
              </button>
              <span className="landing-trust-line">
                Trusted by sustainability teams across industries
              </span>
            </div>
          </div>



          {/* Footer strip */}
          <div className="landing-footer-strip">
            Built with scientific rigor. No greenwashing. Reduction-first, always.
          </div>


        </div>

        {/* ΓòÉΓòÉΓòÉ PAGE 2 ΓÇö EXISTING PORTAL SELECTION ΓòÉΓòÉΓòÉ */}
        <div ref={page2Ref} className="landing-page2">
          <div className="relative min-h-screen bg-slate-950 flex items-center justify-center p-6 overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 -left-20 w-72 h-72 bg-emerald-500/8 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
              <div className="absolute bottom-1/3 -right-16 w-64 h-64 bg-teal-500/8 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite_1s]" />
              <div className="absolute top-2/3 left-1/3 w-48 h-48 bg-emerald-400/5 rounded-full blur-3xl animate-[pulse_7s_ease-in-out_infinite_2s]" />
            </div>

            {/* Grid pattern overlay */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }}
            />

            <div className="relative z-10 w-full max-w-3xl mx-auto">
              {/* Logo + Title */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-5">
                  <Leaf className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Welcome to CarbonSense
                </h2>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  Select your portal to sign in. Company staff use the Manager or Viewer portals.
                </p>
              </div>

              {/* Role Cards ΓÇö Reusing existing RolePortalCard component */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RolePortalCard
                  role="admin"
                  title="Platform Admin"
                  description="CarbonSense internal team only. Manage companies, managers, and platform-level operations."
                  href="/login/admin"
                  badge="Internal"
                />
                <RolePortalCard
                  role="manager"
                  title="Manager Portal"
                  description="Your company's carbon program hub. Upload data, manage your team, and submit reports."
                  href="/login/manager"
                />
                <RolePortalCard
                  role="viewer"
                  title="Viewer Portal"
                  description="View your company's carbon dashboards and personal emissions insights."
                  href="/login/viewer"
                />
              </div>

              {/* Footer */}
              <p className="text-center text-xs text-slate-600 mt-10">
                Built with scientific rigor. No greenwashing. Reduction-first, always.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
