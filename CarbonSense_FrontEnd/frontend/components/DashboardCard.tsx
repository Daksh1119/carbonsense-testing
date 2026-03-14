import { ReactNode } from "react";
import { clsx } from "clsx";

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export default function DashboardCard({
  title,
  subtitle,
  children,
  icon,
  className,
  headerAction,
}: DashboardCardProps) {
  return (
    <div className={clsx("glass-card rounded-xl p-6", className)}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="text-primary">{icon}</div>
          )}
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            {subtitle && (
              <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {headerAction && <div>{headerAction}</div>}
      </div>
      {children}
    </div>
  );
}
