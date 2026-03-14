"use client";

import { useState, useEffect } from "react";
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
  Menu,
  X,
} from "lucide-react";
import { clsx } from "clsx";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Emissions", href: "/emissions", icon: Wind },
  { name: "Recommendations", href: "/recommendations", icon: Sparkles },
  { name: "TEME", href: "/tree-engine", icon: TreePine },
  { name: "Policy", href: "/policy-intelligence", icon: Gavel },
  { name: "Compliance", href: "/compliance", icon: ShieldCheck },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface CollapsibleSidebarProps {
  defaultCollapsed?: boolean;
}

export default function CollapsibleSidebar({ defaultCollapsed = false }: CollapsibleSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState !== null) {
      setIsCollapsed(savedState === 'true');
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const closeMobile = () => {
    setIsMobileOpen(false);
  };

  // Sidebar content component (reused for both desktop and mobile)
  const SidebarContent = ({ showLabels }: { showLabels: boolean }) => (
    <>
      {/* Logo */}
      <div className={clsx(
        "p-6 flex items-center transition-all duration-300",
        showLabels ? "gap-3" : "gap-0 justify-center"
      )}>
        <div className="bg-primary size-8 rounded flex items-center justify-center text-background-dark flex-shrink-0">
          <Leaf className="size-5" />
        </div>
        {showLabels && (
          <div className="overflow-hidden">
            <h1 className="text-white text-lg font-bold leading-tight whitespace-nowrap">
              CarbonSense
            </h1>
            <p className="text-primary text-[10px] font-bold tracking-widest uppercase whitespace-nowrap">
              Intelligence Platform
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={clsx(
                "flex items-center rounded-lg transition-colors",
                showLabels ? "gap-3 px-3 py-2" : "gap-0 justify-center p-3",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 glow-primary"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
              title={!showLabels ? item.name : undefined}
            >
              <Icon
                className={clsx(
                  "size-4 flex-shrink-0",
                  isActive && "drop-shadow-[0_0_8px_rgba(11,213,176,0.6)]"
                )}
              />
              {showLabels && (
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-navy-border/50">
        <Link
          href="/help"
          onClick={closeMobile}
          className={clsx(
            "flex items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors",
            showLabels ? "gap-3 px-3 py-2" : "gap-0 justify-center p-3"
          )}
          title={!showLabels ? "Help Center" : undefined}
        >
          <HelpCircle className="size-4 flex-shrink-0" />
          {showLabels && <span className="text-sm font-medium">Help Center</span>}
        </Link>
        <button
          onClick={closeMobile}
          className={clsx(
            "flex items-center rounded-lg text-rose-400 hover:bg-rose-400/5 transition-colors mt-1 w-full",
            showLabels ? "gap-3 px-3 py-2" : "gap-0 justify-center p-3"
          )}
          title={!showLabels ? "Logout" : undefined}
        >
          <LogOut className="size-4 flex-shrink-0" />
          {showLabels && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobile}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={clsx(
          "lg:hidden fixed top-0 left-0 bottom-0 z-40 w-64 flex flex-col bg-background-dark border-r border-navy-border/50 transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent showLabels={true} />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          "hidden lg:flex flex-shrink-0 flex-col bg-background-dark border-r border-navy-border/50 transition-all duration-300 relative",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <SidebarContent showLabels={!isCollapsed} />

        {/* Collapse Toggle Button */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full p-1 text-slate-400 hover:text-white transition-colors z-10"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </aside>
    </>
  );
}
