"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Bell, FileDown, LogOut, User, ChevronDown } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useUserStore } from "@/store";
import type { Role } from "@/lib/authHelpers";

interface NavbarProps {
  title?: string;
  subtitle?: string;
  showExportButton?: boolean;
}

const ROLE_BADGE: Record<Role, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  manager: { label: "Manager", className: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  viewer: { label: "Viewer", className: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
};

export default function Navbar({
  title = "Executive Dashboard",
  subtitle,
  showExportButton = false,
}: NavbarProps) {
  const { user, logout } = useUserStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    setShowDropdown(false);
    await logout();
    window.location.href = "/login";
  };

  const userRole = (user?.role ?? "admin") as Role;
  const badge = ROLE_BADGE[userRole];
  const displayName = user?.name || "User";
  const displayEmail = user?.email || "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="border-b border-navy-border/50 bg-background-dark/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Title Section */}
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search carbon data, reports, or policies..."
              className="w-96 pl-10 pr-4 py-2 bg-navy-muted/50 border border-navy-border/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {/* Export Button */}
          {showExportButton && (
            <button className="px-4 py-2 bg-primary text-background-dark font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
              <FileDown className="size-4" />
              Export Report
            </button>
          )}

          {/* Theme Toggle */}
          <ThemeToggle variant="icon-only" />

          {/* Notifications */}
          <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <Bell className="size-5" />
            <span className="absolute top-1 right-1 size-2 bg-rose-500 rounded-full"></span>
          </button>

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 pl-4 border-l border-navy-border/50 hover:opacity-80 transition-opacity"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white">{displayName}</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span
                    className={`inline-flex items-center px-1.5 py-0 rounded text-[9px] font-semibold uppercase tracking-wider border ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
              <div className="size-10 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-emerald-400">{initials}</span>
                )}
              </div>
              <ChevronDown className="size-3.5 text-slate-500" />
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-800">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-slate-400 truncate">{displayEmail}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <User className="size-4" />
                    Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 transition-colors"
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
