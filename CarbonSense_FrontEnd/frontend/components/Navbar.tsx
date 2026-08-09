"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, FileDown, LogOut, User, ChevronDown, CheckCircle2, AlertTriangle, Clock, Upload, TreePine, ShieldAlert } from "lucide-react";
import { useUserStore } from "@/store";
import type { Role } from "@/lib/authHelpers";
import { fetchComplianceDeadlines, ComplianceDeadlineRecord } from "@/lib/policy-compliance-api";
import { fetchEmissionsUploadsScoped } from "@/lib/emissions-api";
import { getLatestTEMERun, getCurrentUserContext } from "@/lib/recommendations-api";

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

// ─── Notification System ──────────────────────────────────────────────────────

type NotifSeverity = "critical" | "warning" | "info" | "success";

interface Notification {
  id: string;
  severity: NotifSeverity;
  title: string;
  body: string;
  icon: React.ReactNode;
  ts?: string;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60));
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function severityColor(s: NotifSeverity) {
  return {
    critical: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    info: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    success: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  }[s];
}

function dotColor(s: NotifSeverity) {
  return { critical: "bg-rose-500", warning: "bg-amber-500", info: "bg-sky-500", success: "bg-emerald-500" }[s];
}

function useNotifications(userId?: string) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const ctx = getCurrentUserContext();
      const results: Notification[] = [];

      // Compliance deadlines
      try {
        const deadlines = await fetchComplianceDeadlines(45);
        deadlines.forEach((d: ComplianceDeadlineRecord) => {
          if (!d.due_date) return;
          const days = daysUntil(d.due_date);
          const name = d.compliance_requirements?.name ?? "Compliance requirement";
          if (d.status === "overdue" || days < 0) {
            results.push({ id: `dl-ov-${d.id}`, severity: "critical", title: "Compliance overdue", body: `${name} was due ${Math.abs(days)}d ago — submit evidence immediately.`, icon: <ShieldAlert className="size-3.5" />, ts: d.due_date });
          } else if (days <= 7) {
            results.push({ id: `dl-cr-${d.id}`, severity: "critical", title: "Deadline in < 7 days", body: `${name} is due in ${days} day${days === 1 ? "" : "s"}.`, icon: <AlertTriangle className="size-3.5" />, ts: d.due_date });
          } else if (days <= 30) {
            results.push({ id: `dl-wn-${d.id}`, severity: "warning", title: "Upcoming deadline", body: `${name} is due in ${days} days.`, icon: <Clock className="size-3.5" />, ts: d.due_date });
          }
        });
      } catch { /* silent */ }

      // Recent emission uploads (last 48h)
      try {
        const uploads = await fetchEmissionsUploadsScoped({ organizationId: ctx.organizationId, userId: ctx.userId });
        uploads.filter((u) => (Date.now() - new Date(u.created_at).getTime()) / 3_600_000 < 48 && Number(u.record_count || 0) > 0).slice(0, 2).forEach((u) => {
          results.push({ id: `up-${u.id}`, severity: "info", title: "Emission data uploaded", body: `${u.original_file_name || "File"} · ${u.record_count} records · ${u.total_emissions_tco2e?.toFixed(2) ?? "?"} tCO₂e`, icon: <Upload className="size-3.5" />, ts: u.created_at });
        });
      } catch { /* silent */ }

      // Latest TEME run (last 24h)
      try {
        if (ctx.userId) {
          const run = await getLatestTEMERun(ctx.userId);
          if (run?.created_at && (Date.now() - new Date(run.created_at).getTime()) / 3_600_000 < 24) {
            results.push({ id: `teme-${run.id}`, severity: "success", title: "TEME analysis complete", body: `"${run.project_name}" — ${Number(run.emission_kg).toLocaleString("en-IN")} kg offset plan ready.`, icon: <TreePine className="size-3.5" />, ts: run.created_at });
          }
        }
      } catch { /* silent */ }

      results.sort((a, b) => {
        const order: Record<NotifSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
        if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
        return new Date(b.ts ?? 0).getTime() - new Date(a.ts ?? 0).getTime();
      });
      setNotifs(results);
    } catch { /* keep previous */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { notifs, loading };
}

function NotificationBell({ userId }: { userId?: string }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifs, loading } = useNotifications(userId);
  const criticalCount = notifs.filter((n) => n.severity === "critical").length;
  const unread = Math.max(0, notifs.length - seen);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => { setOpen((v) => !v); setSeen(notifs.length); }} aria-label="Notifications" className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50">
        <Bell className="size-5" />
        {unread > 0 && (
          <span className={`absolute top-1 right-1 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-1 text-white ${criticalCount > 0 ? "bg-rose-500" : "bg-amber-500"}`}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] overflow-y-auto bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl z-50 flex flex-col">
          <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Notifications</p>
              {notifs.length > 0 && <p className="text-xs text-slate-400 mt-0.5">{criticalCount > 0 ? `${criticalCount} critical action${criticalCount > 1 ? "s" : ""} required` : `${notifs.length} update${notifs.length > 1 ? "s" : ""}`}</p>}
            </div>
            {loading && <span className="text-xs text-slate-500 animate-pulse">Refreshing…</span>}
          </div>

          <div className="flex flex-col divide-y divide-slate-800">
            {notifs.length === 0 && !loading && (
              <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
                <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="size-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">All systems clear</p>
                  <p className="text-xs text-slate-400 mt-1">No pending alerts, deadlines, or actions for your organisation.</p>
                </div>
              </div>
            )}
            {notifs.map((n) => (
              <div key={n.id} className="flex gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors">
                <div className={`mt-2 size-1.5 rounded-full shrink-0 ${dotColor(n.severity)}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityColor(n.severity)}`}>
                      {n.icon}{n.title}
                    </span>
                    {n.ts && <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(n.ts)}</span>}
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{n.body}</p>
                </div>
              </div>
            ))}
          </div>

          {notifs.length > 0 && (
            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 px-4 py-2.5">
              <p className="text-xs text-slate-500 text-center">Refreshes every 60s · Critical items require immediate action</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────

export default function Navbar({ title = "Executive Dashboard", subtitle, showExportButton = false }: NavbarProps) {
  const { user, logout } = useUserStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleLogout = async () => { setShowDropdown(false); await logout(); window.location.href = "/login"; };

  const userRole = (user?.role ?? "admin") as Role;
  const badge = ROLE_BADGE[userRole];
  const displayName = user?.name || "User";
  const displayEmail = user?.email || "";
  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <header className="border-b border-navy-border/50 bg-background-dark/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-4">
          {showExportButton && (
            <button className="px-4 py-2 bg-primary text-background-dark font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
              <FileDown className="size-4" />
              Export Report
            </button>
          )}

          <NotificationBell userId={user?.id} />

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 pl-4 border-l border-navy-border/50 hover:opacity-80 transition-opacity"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white">{displayName}</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className={`inline-flex items-center px-1.5 py-0 rounded text-[9px] font-semibold uppercase tracking-wider border ${badge.className}`}>
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
