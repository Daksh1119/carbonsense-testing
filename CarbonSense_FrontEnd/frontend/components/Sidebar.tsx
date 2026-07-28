"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wind,
  Sparkles,
  TreePine,
  Gavel,
  ShieldCheck,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  Leaf,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { useUserStore } from "@/store";
import type { Role } from "@/lib/authHelpers";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Default admin nav items (used when no navItems prop is passed)
const defaultNavItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Emissions", href: "/emissions", icon: Wind },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Recommendations", href: "/recommendations", icon: Sparkles },
  { name: "TEME", href: "/tree-engine", icon: TreePine },
  { name: "Policy", href: "/policy-intelligence", icon: Gavel },
  { name: "Compliance", href: "/compliance", icon: ShieldCheck },
  { name: "Team", href: "/team-management", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

const ROLE_BADGE: Record<Role, { label: string; className: string }> = {
  admin: {
    label: "Platform Admin",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  manager: {
    label: "Manager",
    className: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  },
  viewer: {
    label: "Viewer",
    className: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  },
};

interface SidebarProps {
  navItems?: NavItem[];
  role?: Role;
}

export default function Sidebar({ navItems, role }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useUserStore();

  const items = navItems ?? defaultNavItems;
  const userRole = role ?? (user?.role as Role) ?? "admin";
  const badge = ROLE_BADGE[userRole];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <aside
      className={clsx(
        "flex-shrink-0 flex flex-col bg-background-dark border-r border-navy-border/50 transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={clsx("p-6 flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
        <div className="bg-primary size-8 rounded flex items-center justify-center text-background-dark flex-shrink-0">
          <Leaf className="size-5" />
        </div>
        {!isCollapsed && (
          <div className="flex-1">
            <h1 className="text-white text-lg font-bold leading-tight">
              CarbonSense
            </h1>
            <p className="text-primary text-[10px] font-bold tracking-widest uppercase">
              Intelligence Platform
            </p>
          </div>
        )}
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={clsx(
            "p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors",
            isCollapsed && "mx-auto mt-4"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* Role Badge */}
      {!isCollapsed && badge && (
        <div className="px-6 mb-3">
          <span
            className={clsx(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
              badge.className
            )}
          >
            {badge.label}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 glow-primary"
                  : "text-slate-400 hover:text-white hover:bg-white/5",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon
                className={clsx(
                  "size-4 flex-shrink-0",
                  isActive && "drop-shadow-[0_0_8px_rgba(11,213,176,0.6)]"
                )}
              />
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-navy-border/50">
        {/* User info (when expanded) */}
        {!isCollapsed && user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        )}

        <Link
          href="/help"
          className={clsx(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? "Help Center" : undefined}
        >
          <HelpCircle className="size-4 flex-shrink-0" />
          {!isCollapsed && (
            <span className="text-sm font-medium">Help Center</span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          className={clsx(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-400/5 transition-colors mt-1 w-full",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="size-4 flex-shrink-0" />
          {!isCollapsed && (
            <span className="text-sm font-medium">Logout</span>
          )}
        </button>
      </div>
    </aside>
  );
}
