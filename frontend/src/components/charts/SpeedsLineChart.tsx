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
  tNum: number;            // epoch ms
  aws: number | null;      // apparent wind speed
  speed: number | null;    // boat speed
  tws: number | null;      // true@10m
};

export type SpeedChartColors = {
  axis: string;
  grid: string;
  legend: string;
  line1: string; // aws
  line2: string; // speed
  line3: string; // tws
};

const DEFAULT: SpeedChartColors = {
  axis: "var(--color-chart-axis)",
  grid: "var(--color-chart-grid)",
  legend: "var(--color-chart-legend)",
  line1: "var(--color-chart-line-1)",
  line2: "var(--color-chart-line-2)",
  line3: "var(--color-chart-line-3)",
};

export type SpeedsLineChartProps = {
  data: SeriesPoint[];
  onHover?: (index: number | null) => void;
  colors?: Partial<SpeedChartColors>;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  fmtTime?: (d: Date) => string;
};

export default function SpeedsLineChart({
  data,
  onHover,
  colors,
  margin,
  fmtTime = (d) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
}: SpeedsLineChartProps) {
  const c = { ...DEFAULT, ...(colors ?? {}) };

  if (!data || data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 10, right: 16, bottom: 10, left: 8, ...(margin ?? {}) }}
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

        <YAxis stroke={c.axis} tick={{ fill: c.axis }} />

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
          dataKey="aws"
          stroke={c.line1}
          strokeOpacity={0.2}
          strokeWidth={6}
          dot={false}
          isAnimationActive={false}
          connectNulls
          legendType="none"
        />
        <Line
          type="monotone"
          dataKey="speed"
          stroke={c.line2}
          strokeOpacity={0.2}
          strokeWidth={6}
          dot={false}
          isAnimationActive={false}
          connectNulls
          legendType="none"
        />
        <Line
          type="monotone"
          dataKey="tws"
          stroke={c.line3}
          strokeOpacity={0.2}
          strokeWidth={6}
          dot={false}
          isAnimationActive={false}
          connectNulls
          legendType="none"
        />

        {/* main */}
        <Line
          type="monotone"
          dataKey="aws"
          name="Apparent (m/s)"
          stroke={c.line1}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="speed"
          name="Boat (m/s)"
          stroke={c.line2}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="tws"
          name="True@10m (m/s)"
          stroke={c.line3}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
