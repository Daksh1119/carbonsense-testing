"use client";

type ScoreRingProps = {
  value: number;
  max: number;
  label: string;
  color: "blue" | "teal" | "purple" | "green" | "amber" | "rose";
  subLabel?: string;
};

const colorMap = {
  blue: { stroke: "#3b82f6", track: "rgba(59, 130, 246, 0.16)" },
  teal: { stroke: "#14b8a6", track: "rgba(20, 184, 166, 0.16)" },
  purple: { stroke: "#a855f7", track: "rgba(168, 85, 247, 0.16)" },
  green: { stroke: "#22c55e", track: "rgba(34, 197, 94, 0.16)" },
  amber: { stroke: "#f59e0b", track: "rgba(245, 158, 11, 0.16)" },
  rose: { stroke: "#f43f5e", track: "rgba(244, 63, 94, 0.16)" },
};

export default function ScoreRing({ value, max, label, color, subLabel }: ScoreRingProps) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;
  const palette = colorMap[color];

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-navy-border bg-navy-muted/30 p-5">
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke={palette.track} strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={palette.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 700ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-2xl font-bold text-white">{Math.round(value)}</div>
          <div className="text-xs text-slate-400">/ {max}</div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-white">{label}</div>
        {subLabel ? <div className="text-xs text-slate-400">{subLabel}</div> : null}
      </div>
    </div>
  );
}