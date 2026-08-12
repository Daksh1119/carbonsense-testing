"use client";

/**
 * Sidebar component — upgraded for Group 2.8
 * Supports optional `alertCount` per nav item (shows red badge).
 * Policy + Compliance items get live deadline counts fetched from Supabase.
 */

import { useEffect, useState } from "react";
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
import { supabase } from "@/lib/supabaseClient";
import type { Role } from "@/lib/authHelpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  alertCount?: number; // if > 0, renders a red badge
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

// ---------------------------------------------------------------------------
// Alert badge sub-component
// ---------------------------------------------------------------------------

function AlertBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hook — deadline alert counts (Group 2.8)
// ---------------------------------------------------------------------------

/**
 * Fetches upcoming compliance deadlines (within 30 days) and overdue items
 * for the organization, returning counts per module.
 */
function useAlertCounts(organizationId?: string) {
  const [policyCount, setPolicyCount] = useState(0);
  const [complianceCount, setComplianceCount] = useState(0);

  useEffect(() => {
    if (!organizationId) return;

    async function fetchCounts() {
      try {
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);

        // Compliance: count overdue + due within 30 days
        const { data: deadlines } = await supabase
          .from("compliance_results")
          .select("id, due_date, status")
          .eq("organization_id", organizationId)
          .not("status", "in", '("completed","verified")')
          .lte("due_date", in30Days.toISOString());

        setComplianceCount((deadlines ?? []).length);

        // Policy: count adopted = "not_started" for policies with mandatory layer
        // Proxy: policies that exist in the catalog but have no adoption row yet
        const { data: adoptions } = await supabase
          .from("organization_policy_adoption")
          .select("policy_id, status")
          .eq("organization_id", organizationId)
          .in("status", ["not_started", "in_progress"]);

        // Count non-adopted (not_started + in_progress) policies as actionable
        setPolicyCount((adoptions ?? []).filter((a) => a.status === "not_started").length);
      } catch {
        // non-fatal — sidebar still renders without counts
      }
    }

    fetchCounts();

    // Realtime subscription for compliance_results changes
    const channel = supabase
      .channel(`sidebar-alerts-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "compliance_results", filter: `organization_id=eq.${organizationId}` },
        () => fetchCounts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "organization_policy_adoption", filter: `organization_id=eq.${organizationId}` },
        () => fetchCounts()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organizationId]);

  return { policyCount, complianceCount };
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function Sidebar({ navItems, role }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useUserStore();

  const { policyCount, complianceCount } = useAlertCounts(user?.organizationId);

  // Merge alert counts into nav items
  const baseItems = navItems ?? defaultNavItems;
  const items: NavItem[] = baseItems.map((item) => {
    if (item.href === "/policy-intelligence" || item.href.includes("policy")) {
      return { ...item, alertCount: policyCount };
    }
    if (item.href === "/compliance" || item.href.includes("compliance")) {
      return { ...item, alertCount: 0 };
    }
    return item;
  });

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
            <h1 className="text-white text-lg font-bold leading-tight">CarbonSense</h1>
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
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const count = item.alertCount ?? 0;

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
              {/* Icon with optional red dot when collapsed */}
              <div className="relative flex-shrink-0">
                <Icon
                  className={clsx(
                    "size-4",
                    isActive && "drop-shadow-[0_0_8px_rgba(11,213,176,0.6)]"
                  )}
                />
                {/* Collapsed state: tiny dot indicator */}
                {isCollapsed && count > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </div>

              {/* Expanded state: label + badge */}
              {!isCollapsed && (
                <>
                  <span className="text-sm font-medium flex-1">{item.name}</span>
                  <AlertBadge count={count} />
                </>
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
          {!isCollapsed && <span className="text-sm font-medium">Help Center</span>}
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
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
