import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import type { SeriesPoint } from "../../types/api";
import { fmtTime } from "../../lib/time";

export function SpeedsLineChart({
  data,
  colors,
  onHoverIndex,
}: {
  data: SeriesPoint[];
  colors: { axis: string; grid: string; legend: string; line1: string; line2: string; line3: string };
  onHoverIndex?: (idx: number | null) => void;
}) {
  const axis = colors.axis;
  const grid = colors.grid;
  const c1 = colors.line1;
  const c2 = colors.line2;
  const c3 = colors.line3;

  const chartData = useMemo(() => data, [data]);

  return (
    <LineChart
      data={chartData}
      margin={{ top: 10, right: 16, bottom: 10, left: 8 }}
      onMouseMove={(s: any) =>
        onHoverIndex?.(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)
      }
      onMouseLeave={() => onHoverIndex?.(null)}
    >
      <CartesianGrid stroke={grid} strokeDasharray="2 6" />
      <XAxis
        dataKey="tNum"
        type="number"
        scale="time"
        domain={["dataMin", "dataMax"]}
        stroke={axis}
        tick={{ fill: axis }}
        tickFormatter={(value: number) => fmtTime(new Date(value))}
        allowDuplicatedCategory={false}
      />
      <YAxis stroke={axis} tick={{ fill: axis }} />
      <Tooltip
        contentStyle={{
          background: "rgba(15,20,26,0.95)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          color: "#dbe3ee",
        }}
        labelStyle={{ color: "#dbe3ee" }}
        labelFormatter={(label: any) => fmtTime(new Date(Number(label)))}
      />
      <Legend wrapperStyle={{ color: colors.legend }} iconType="plainline" />

      {/* glow layers */}
      <Line type="monotone" dataKey="aws"   stroke={c1} strokeOpacity={0.2} strokeWidth={6} dot={false} isAnimationActive={false} />
      <Line type="monotone" dataKey="speed" stroke={c2} strokeOpacity={0.2} strokeWidth={6} dot={false} isAnimationActive={false} />
      <Line type="monotone" dataKey="tws"   stroke={c3} strokeOpacity={0.2} strokeWidth={6} dot={false} isAnimationActive={false} />

      {/* main strokes */}
      <Line type="monotone" dataKey="aws"   name="Apparent (m/s)" stroke={c1} strokeWidth={2} dot={false} isAnimationActive={false} />
      <Line type="monotone" dataKey="speed" name="Boat (m/s)"     stroke={c2} strokeWidth={2} dot={false} isAnimationActive={false} />
      <Line type="monotone" dataKey="tws"   name="True@10m (m/s)" stroke={c3} strokeWidth={2} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}
