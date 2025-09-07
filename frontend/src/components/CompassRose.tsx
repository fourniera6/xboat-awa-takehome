import { useMemo } from "react";
import { roseBins, binIndex } from "../lib/roses";
import { DEG2RAD } from "../lib/math";
import { Card } from "./Card";

export function CompassRose({
  title,
  angles,
  binSize = 15,
  size = 260,
  ringCount = 4,
  highlightAngles = [],
  highlightColor = "var(--color-primary)",
}: {
  title: string;
  angles: number[];
  binSize?: number;
  size?: number;
  ringCount?: number;
  highlightAngles?: number[];
  highlightColor?: string;
}) {
  const pad = 16;
  const R = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;

  const { bins, max } = useMemo(() => roseBins(angles, binSize), [angles, binSize]);

  const activeIdx = useMemo(() => {
    const s = new Set<number>();
    for (const a of highlightAngles) {
      if (a == null || Number.isNaN(a)) continue;
      s.add(binIndex(a, binSize));
    }
    return s;
  }, [highlightAngles, binSize]);

  const grid = "var(--color-chart-grid)";
  const axis = "var(--color-chart-axis)";
  const fill = "var(--color-chart-line-1)";

  const polar = (r: number, deg: number) => {
    const θ = (deg - 90) * DEG2RAD;
    return [cx + r * Math.cos(θ), cy + r * Math.sin(θ)];
  };

  const sectorPath = (r: number, a0: number, a1: number) => {
    const [x0, y0] = polar(r, a0);
    const [x1, y1] = polar(r, a1);
    const large = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
  };

  return (
    <Card title={title} className="w-full">
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }}>
        {Array.from({ length: ringCount }, (_, i) => {
          const rr = ((i + 1) / ringCount) * R;
          return (
            <circle key={rr} cx={cx} cy={cy} r={rr} fill="none" stroke={grid} strokeDasharray="2 6" />
          );
        })}
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke={grid} />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke={grid} />
        <text x={cx} y={cy - R - 6} textAnchor="middle" fill={axis} fontSize="10">N</text>
        <text x={cx + R + 6} y={cy + 3} fill={axis} fontSize="10">E</text>
        <text x={cx} y={cy + R + 12} textAnchor="middle" fill={axis} fontSize="10">S</text>
        <text x={cx - R - 6} y={cy + 3} textAnchor="end" fill={axis} fontSize="10">W</text>

        {bins.map((b, i) => {
          const r = max > 0 ? (b.count / max) * R : 0;
          if (r <= 0) return null;
          const hot = activeIdx.has(i);
          return (
            <path
              key={b.start}
              d={sectorPath(r, b.start, b.end)}
              fill={hot ? highlightColor : fill}
              fillOpacity={hot ? 0.95 : 0.55}
              stroke={hot ? highlightColor : fill}
              strokeOpacity={hot ? 1 : 0.9}
              strokeWidth={hot ? 2 : 0.5}
            />
          );
        })}
      </svg>
      <div className="mt-2 text-xs text-muted">Bin: {binSize}°, Samples: {angles.length.toLocaleString()}</div>
    </Card>
  );
}
