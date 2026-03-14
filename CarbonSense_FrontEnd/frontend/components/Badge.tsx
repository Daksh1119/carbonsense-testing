import { clsx } from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
}

export default function Badge({
  children,
  variant = "default",
  size = "md",
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center font-medium rounded-full",
        {
          "px-2 py-0.5 text-[10px]": size === "sm",
          "px-3 py-1 text-xs": size === "md",
          "px-4 py-1.5 text-sm": size === "lg",
        },
        {
          "bg-slate-800 text-slate-300 border border-slate-700":
            variant === "default",
          "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20":
            variant === "success",
          "bg-amber-500/10 text-amber-400 border border-amber-500/20":
            variant === "warning",
          "bg-rose-500/10 text-rose-400 border border-rose-500/20":
            variant === "danger",
          "bg-primary/10 text-primary border border-primary/20":
            variant === "info",
        }
      )}
    >
      {children}
    </span>
  );
}
