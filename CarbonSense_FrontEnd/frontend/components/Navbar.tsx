"use client";

import { Search, Bell, FileDown } from "lucide-react";
import Image from "next/image";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface NavbarProps {
  title?: string;
  subtitle?: string;
  showExportButton?: boolean;
}

export default function Navbar({
  title = "Executive Dashboard",
  subtitle,
  showExportButton = false,
}: NavbarProps) {
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
          <div className="relative">
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

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-navy-border/50">
            <div className="text-right">
              <p className="text-sm font-semibold text-white">Sarah Chen</p>
              <p className="text-xs text-slate-400">Chief Climate Officer</p>
            </div>
            <div className="size-10 rounded-full bg-slate-700 overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-primary to-teal-600"></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
