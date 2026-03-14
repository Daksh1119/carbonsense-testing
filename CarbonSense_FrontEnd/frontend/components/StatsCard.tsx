import { ReactNode } from "react";
import { clsx } from "clsx";

interface StatsCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
  trend?: ReactNode;
}

export default function StatsCard({
  title,
  value,
  unit,
  change,
  changeType = "neutral",
  icon,
  trend,
}: StatsCardProps) {
  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-white">{value}</h3>
            {unit && <span className="text-sm text-slate-400">{unit}</span>}
          </div>
        </div>
        {icon && (
          <div className="text-slate-400 opacity-50">{icon}</div>
        )}
      </div>

      {(change || trend) && (
        <div className="flex items-center justify-between">
          {change && (
            <div
              className={clsx(
                "text-xs font-medium flex items-center gap-1",
                changeType === "positive" && "text-emerald-400",
                changeType === "negative" && "text-rose-400",
                changeType === "neutral" && "text-slate-400"
              )}
            >
              {changeType === "positive" && "↓"}
              {changeType === "negative" && "↑"}
              {change}
            </div>
          )}
          {trend && <div className="flex-1 ml-2">{trend}</div>}
        </div>
      )}
    </div>
  );
}
