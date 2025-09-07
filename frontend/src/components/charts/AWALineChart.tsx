import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import type { SeriesPoint } from "../../types/api";
import { fmtTime } from "../../lib/time";

export function AWALineChart({
  data,
  colors,
  onHoverIndex,
}: {
  data: SeriesPoint[];
  colors: { axis: string; grid: string; legend: string; line1: string };
  onHoverIndex?: (idx: number | null) => void;
}) {
  const axis = colors.axis;
  const grid = colors.grid;
  const c1 = colors.line1;

  const chartData = useMemo(() => data, [data]);

  return (
    <LineChart
      data={chartData}
      margin={{ top: 14, right: 16, bottom: 10, left: 8 }}
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
      <YAxis domain={[-180, 180]} stroke={axis} tick={{ fill: axis }} />
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
      <Line type="monotone" dataKey="awa" stroke={c1} strokeOpacity={0.25} strokeWidth={6} dot={false} isAnimationActive={false} />
      <Line type="monotone" dataKey="awa" name="AWA (deg)" stroke={c1} strokeWidth={2} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}
