'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { clsx } from 'clsx';

export interface ThemeToggleProps {
  variant?: 'button' | 'dropdown' | 'icon-only';
  className?: string;
}

/**
 * ThemeToggle Component
 * Allows users to switch between light, dark, and system themes
 */
export default function ThemeToggle({ variant = 'button', className }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with the same dimensions to avoid layout shift
    return (
      <div className={clsx('w-10 h-10', className)} />
    );
  }

  if (variant === 'icon-only') {
    return (
      <button
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className={clsx(
          'p-2 rounded-lg transition-colors',
          'hover:bg-slate-700/50 active:bg-slate-700',
          'border border-slate-700 hover:border-slate-600',
          className
        )}
        aria-label="Toggle theme"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-5 h-5 text-emerald-400" />
        ) : (
          <Moon className="w-5 h-5 text-slate-400" />
        )}
      </button>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className={clsx('relative inline-block', className)}>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className={clsx(
            'appearance-none pl-10 pr-10 py-2 rounded-lg',
            'bg-slate-800 border border-slate-700',
            'text-slate-200 text-sm font-medium',
            'hover:border-slate-600 focus:border-emerald-500',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
            'cursor-pointer transition-colors'
          )}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {theme === 'light' && <Sun className="w-4 h-4 text-slate-400" />}
          {theme === 'dark' && <Moon className="w-4 h-4 text-emerald-400" />}
          {theme === 'system' && <Monitor className="w-4 h-4 text-blue-400" />}
        </div>
      </div>
    );
  }

  // Default button variant with three options
  return (
    <div className={clsx('inline-flex rounded-lg bg-slate-800 border border-slate-700 p-1', className)}>
      <button
        onClick={() => setTheme('light')}
        className={clsx(
          'px-3 py-1.5 rounded-md transition-all text-sm font-medium',
          'flex items-center gap-2',
          theme === 'light'
            ? 'bg-slate-700 text-slate-100 shadow-sm'
            : 'text-slate-400 hover:text-slate-300'
        )}
        aria-label="Light mode"
      >
        <Sun className="w-4 h-4" />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={clsx(
          'px-3 py-1.5 rounded-md transition-all text-sm font-medium',
          'flex items-center gap-2',
          theme === 'dark'
            ? 'bg-slate-700 text-slate-100 shadow-sm'
            : 'text-slate-400 hover:text-slate-300'
        )}
        aria-label="Dark mode"
      >
        <Moon className="w-4 h-4" />
        <span className="hidden sm:inline">Dark</span>
      </button>
      <button
        onClick={() => setTheme('system')}
        className={clsx(
          'px-3 py-1.5 rounded-md transition-all text-sm font-medium',
          'flex items-center gap-2',
          theme === 'system'
            ? 'bg-slate-700 text-slate-100 shadow-sm'
            : 'text-slate-400 hover:text-slate-300'
        )}
        aria-label="System theme"
      >
        <Monitor className="w-4 h-4" />
        <span className="hidden sm:inline">System</span>
      </button>
    </div>
  );
}
