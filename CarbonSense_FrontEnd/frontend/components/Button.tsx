import { clsx } from "clsx";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        {
          "px-3 py-1.5 text-sm": size === "sm",
          "px-4 py-2 text-sm": size === "md",
          "px-6 py-3 text-base": size === "lg",
        },
        {
          "bg-primary text-background-dark hover:opacity-90":
            variant === "primary",
          "bg-navy-muted text-white hover:bg-navy-card border border-navy-border":
            variant === "secondary",
          "bg-transparent text-primary border border-primary/30 hover:bg-primary/10":
            variant === "outline",
          "bg-transparent text-slate-400 hover:bg-white/5 hover:text-white":
            variant === "ghost",
          "bg-rose-500 text-white hover:bg-rose-600": variant === "danger",
        },
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
