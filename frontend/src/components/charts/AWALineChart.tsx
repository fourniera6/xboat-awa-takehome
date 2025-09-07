import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export type SeriesPoint = {
  tNum: number;          // epoch ms
  awa: number | null;    // -180..180
};

export type AwaChartColors = {
  axis: string;
  grid: string;
  legend: string;
  line1: string;
};

const DEFAULT: AwaChartColors = {
  axis: "var(--color-chart-axis)",
  grid: "var(--color-chart-grid)",
  legend: "var(--color-chart-legend)",
  line1: "var(--color-chart-line-1)",
};

export type AwaLineChartProps = {
  data: SeriesPoint[];
  onHover?: (index: number | null) => void;
  colors?: Partial<AwaChartColors>;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  fmtTime?: (d: Date) => string;
};

export default function AWALineChart({
  data,
  onHover,
  colors,
  margin,
  fmtTime = (d) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
}: AwaLineChartProps) {
  const c = { ...DEFAULT, ...(colors ?? {}) };

  if (!data || data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 14, right: 16, bottom: 10, left: 8, ...(margin ?? {}) }}
        onMouseMove={(s: any) => {
          const i = s?.activeTooltipIndex;
          if (typeof i === "number") onHover?.(i);
        }}
        onMouseLeave={() => onHover?.(null)}
      >
        <CartesianGrid stroke={c.grid} strokeDasharray="2 6" />

        <XAxis
          dataKey="tNum"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          allowDataOverflow
          stroke={c.axis}
          tick={{ fill: c.axis }}
          tickFormatter={(value: number) => fmtTime(new Date(value))}
        />

        <YAxis
          domain={[-180, 180]}
          stroke={c.axis}
          tick={{ fill: c.axis }}
        />

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

        <Legend wrapperStyle={{ color: c.legend }} iconType="plainline" />

        {/* glow */}
        <Line
          type="monotone"
          dataKey="awa"
          stroke={c.line1}
          strokeOpacity={0.25}
          strokeWidth={6}
          dot={false}
          isAnimationActive={false}
          connectNulls
          legendType="none"
        />
        {/* main */}
        <Line
          type="monotone"
          dataKey="awa"
          name="AWA (deg)"
          stroke={c.line1}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
