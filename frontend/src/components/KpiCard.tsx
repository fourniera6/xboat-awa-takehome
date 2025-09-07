// src/components/ui/KpiCard.tsx
import React from "react";

export function fmtSplit(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export default function KpiCard({
  label,
  value,
  unit,
  hint,
  emphasize = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-[color:var(--color-panel)] shadow-soft p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 flex items-baseline gap-2 ${emphasize ? "text-3xl" : "text-2xl"} font-semibold`}>
        <span>{typeof value === "number" ? value.toLocaleString() : value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted">{hint}</div>}
    </section>
  );
}
