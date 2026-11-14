import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  sublabel,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  tone?: "default" | "ok" | "risk" | "critical";
  icon?: ReactNode;
}) {
  const toneClass =
    tone === "ok"
      ? "text-status-ok"
      : tone === "risk"
      ? "text-status-risk"
      : tone === "critical"
      ? "text-status-critical"
      : "text-slate-50";

  return (
    <div className="panel p-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {icon}
      </div>
      <span className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</span>
      {sublabel && <span className="text-xs text-slate-500">{sublabel}</span>}
    </div>
  );
}
