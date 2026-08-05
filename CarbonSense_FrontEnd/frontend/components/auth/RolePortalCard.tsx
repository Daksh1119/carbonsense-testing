'use client';

import Link from 'next/link';
import type { Role } from '@/lib/authHelpers';
import { Shield, Building2, Eye } from 'lucide-react';

interface RolePortalCardProps {
  role: Role;
  title: string;
  description: string;
  href: string;
  badge?: string;
}

const ROLE_CONFIG: Record<Role, {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  glowColor: string;
  borderColor: string;
}> = {
  admin: {
    icon: Shield,
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    glowColor: 'group-hover:shadow-emerald-500/20',
    borderColor: 'group-hover:border-emerald-500/50',
  },
  manager: {
    icon: Building2,
    gradient: 'from-teal-500/20 to-teal-600/5',
    glowColor: 'group-hover:shadow-teal-500/20',
    borderColor: 'group-hover:border-teal-500/50',
  },
  viewer: {
    icon: Eye,
    gradient: 'from-sky-500/20 to-sky-600/5',
    glowColor: 'group-hover:shadow-sky-500/20',
    borderColor: 'group-hover:border-sky-500/50',
  },
};

export default function RolePortalCard({
  role,
  title,
  description,
  href,
  badge,
}: RolePortalCardProps) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  return (
    <Link href={href} className="group block">
      <div
        className={`
          relative p-6 rounded-2xl border border-slate-700/50
          bg-gradient-to-br ${config.gradient}
          backdrop-blur-xl transition-all duration-300 ease-out
          group-hover:scale-[1.03] group-hover:shadow-2xl
          ${config.glowColor} ${config.borderColor}
          cursor-pointer overflow-hidden
          min-h-[220px] flex flex-col
        `}
      >
        {/* Animated glow dot */}
        <div
          className={`
            absolute -top-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-0
            group-hover:opacity-40 transition-opacity duration-500
            ${role === 'admin' ? 'bg-emerald-500' : role === 'manager' ? 'bg-teal-500' : 'bg-sky-500'}
          `}
        />

        {/* Badge (e.g. "Internal") */}
        {badge && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-slate-700/80 text-slate-300 border border-slate-600/50">
            {badge}
          </div>
        )}

        <div className="relative z-10 flex flex-col flex-1 justify-between">
          {/* Icon */}
          <div
            className={`
              inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4
              transition-all duration-300
              ${role === 'admin'
                ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20'
                : role === 'manager'
                ? 'bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20'
                : 'bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20'
              }
            `}
          >
            <Icon className="w-6 h-6" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-white mb-1.5 group-hover:translate-x-1 transition-transform duration-300">
            {title}
          </h3>

          {/* Description */}
          <p className="text-sm text-slate-400 leading-relaxed">
            {description}
          </p>

          {/* Arrow indicator */}
          <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 group-hover:text-white transition-colors duration-300">
            <span>Continue</span>
            <svg
              className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
