import { clsx } from "clsx";

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: "primary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  color = "primary",
  size = "md",
  showLabel = false,
  label,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-sm text-slate-400">{label}</span>}
          {showLabel && (
            <span className="text-sm font-medium text-white">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={clsx(
          "w-full bg-navy-muted rounded-full overflow-hidden",
          {
            "h-1": size === "sm",
            "h-2": size === "md",
            "h-3": size === "lg",
          }
        )}
      >
        <div
          className={clsx(
            "h-full transition-all duration-300 rounded-full",
            {
              "bg-primary": color === "primary",
              "bg-emerald-500": color === "success",
              "bg-amber-500": color === "warning",
              "bg-rose-500": color === "danger",
            }
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
