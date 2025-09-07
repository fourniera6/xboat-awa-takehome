import React from "react";
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

/* ===================== Types ===================== */
type ParsedPoint = {
  timestamp: string;
  lat?: number;
  lon?: number;
  altitude_m?: number | null;
  speed_m_s?: number | null;
  heart_rate_bpm?: number | null;
  cadence_rpm?: number | null;
};

type ParseResult = {
  source: string;
  points: ParsedPoint[];
  start_time?: string;
  end_time?: string;
  speed_was_derived?: boolean;
};

type ApparentPoint = ParsedPoint & {
  wind_speed_10m_ms?: number | null;
  wind_direction_10m_deg?: number | null;
  awa_deg?: number | null; // apparent angle relative to bow (±180)
  apparent_wind_speed_ms?: number | null;
  boat_u_ms?: number | null; // east
  boat_v_ms?: number | null; // north
};

type ApparentResult = {
  mapped_count?: number;
  start_time?: string;
  end_time?: string;
  sample?: ApparentPoint[];
  points?: ApparentPoint[];
  series?: ApparentPoint[];
  full?: ApparentPoint[];
};

/* Normalized datum for charts/roses */
type SeriesDatum = {
  t: Date;
  tNum: number;
  awa: number | null; // relative (±180)
  aws: number | null;
  speed: number | null;
  tws: number | null;
  heading: number | null; // bearing 0..360 (from N clockwise)
  twd: number | null; // bearing 0..360 (from which it blows)
  awaAbs: number | null; // absolute apparent: wrap(heading + awa)
};

/* ===================== Config ===================== */
const BACKEND = "http://127.0.0.1:8000";
const AUTO_LOAD_SAMPLE = true;
const AUTO_COMPUTE_ON_BOOT = true;
const SAMPLE_URL = `${BACKEND}/samples/activity_20298293877.gpx`;

/* ---------- math + bearings ---------- */
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function wrap360(d: number) {
  const x = d % 360;
  return x < 0 ? x + 360 : x;
}

/** Heading (0=N, 90=E) from ENU components: u=east, v=north */
function headingFromUV(u?: number | null, v?: number | null): number | null {
  if (u == null || v == null) return null;
  return wrap360(Math.atan2(u, v) * RAD2DEG);
}

/** Initial geodesic bearing (0=N, clockwise) between two lat/lon points */
function bearingFromLatLon(
  lat1?: number,
  lon1?: number,
  lat2?: number,
  lon2?: number
): number | null {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null ||
    (lat1 === lat2 && lon1 === lon2)
  )
    return null;
  const φ1 = lat1 * DEG2RAD;
  const φ2 = lat2 * DEG2RAD;
  const Δλ = (lon2 - lon1) * DEG2RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return wrap360(Math.atan2(y, x) * RAD2DEG);
}

/* ---------- rose binning ---------- */
type RoseBin = { start: number; end: number; count: number; center: number };

function roseBins(anglesDeg: number[], binSize = 15): { bins: RoseBin[]; max: number } {
  const size = Math.max(1, binSize);
  const n = Math.round(360 / size);
  const bins: RoseBin[] = Array.from({ length: n }, (_, i) => {
    const start = i * size;
    const end = start + size;
    const center = start + size / 2;
    return { start, end, center, count: 0 };
  });

  for (const a of anglesDeg) {
    if (a == null || Number.isNaN(a)) continue;
    const w = wrap360(a);
    const idx = Math.min(n - 1, Math.floor(w / size));
    bins[idx].count += 1;
  }

  const max = bins.reduce((m, b) => Math.max(m, b.count), 0);
  return { bins, max };
}

/* ===================== Small UI bits ===================== */
function Card({
  title,
  actions,
  className = "",
  children,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "w-full overflow-hidden rounded-2xl",
        "border border-border",
        "bg-[color:var(--color-panel)]",
        "shadow-soft",
        "p-4 md:p-5",
        className,
      ].join(" ")}
    >
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h3 className="text-base font-semibold leading-none">{title}</h3>
          )}
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/* ---------------- Hover panel (sidebar) ---------------- */
function useHoverPanel(opts?: {
  openDelay?: number;
  closeDelay?: number;
  minOpenMs?: number;
}) {
  const openDelay = opts?.openDelay ?? 140;
  const closeDelay = opts?.closeDelay ?? 420;
  const minOpenMs = opts?.minOpenMs ?? 260;

  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const lastOpenAt = React.useRef(0);
  const tOpen = React.useRef<number | null>(null);
  const tClose = React.useRef<number | null>(null);

  const clear = (h: number | null) => h && window.clearTimeout(h);

  const scheduleOpen = () => {
    if (pinned || open) return;
    clear(tClose.current);
    tOpen.current = window.setTimeout(() => {
      setOpen(true);
      lastOpenAt.current = performance.now();
    }, openDelay);
  };

  const cancelOpen = () => clear(tOpen.current);

  const scheduleClose = () => {
    if (pinned) return;
    clear(tOpen.current);
    const elapsed = performance.now() - lastOpenAt.current;
    const guard = Math.max(0, minOpenMs - elapsed);
    const wait = Math.max(closeDelay, guard);
    tClose.current = window.setTimeout(() => setOpen(false), wait);
  };

  const togglePin = () => {
    setPinned((p) => {
      const next = !p;
      if (next) {
        setOpen(true);
        lastOpenAt.current = performance.now();
      }
      return next;
    });
  };

  React.useEffect(() => () => {
    clear(tOpen.current);
    clear(tClose.current);
  }, []);

  return { open, pinned, scheduleOpen, cancelOpen, scheduleClose, togglePin };
}

function SideSettings() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted">Settings</div>
      <div className="text-xs text-muted/80">
        Hover this panel to reveal it. Click <b>Pin</b> to keep it open.
      </div>
    </div>
  );
}

/* ---------------- Chart container ---------------- */
function ChartSection({
  title,
  height = 340,
  dataReady,
  actions,
  children,
}: {
  title: string;
  height?: number;
  dataReady: boolean;
  actions?: React.ReactNode;
  children: React.ReactElement;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(cr.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const ready = dataReady && w > 0;
  return (
    <Card title={title} actions={actions} className="w-full">
      <div ref={ref} className="w-full" style={{ height }}>
        {ready ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-muted">
            {dataReady ? "Measuring layout…" : "Loading data…"}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Compass Rose (memoized) ---------------- */
type CompassRoseProps = {
  title: string;
  angles: number[];
  binSize?: number;
  size?: number;
  ringCount?: number;
  highlightAngles?: number[]; // bins to light up
  highlightColor?: string;
};

const CompassRose = React.memo(function CompassRoseImpl({
  title,
  angles,
  binSize = 15,
  size = 260,
  ringCount = 4,
  highlightAngles = [],
  highlightColor = "var(--color-primary)",
}: CompassRoseProps) {
  const pad = 16;
  const R = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;

  const grid = "var(--color-chart-grid)";
  const axis = "var(--color-chart-axis)";
  const fill = "var(--color-chart-line-1)";

  // Heavy: only when angles/binSize change
  const { bins, max } = React.useMemo(
    () => roseBins(angles, binSize),
    [angles, binSize]
  );

  // Precompute sector paths
  const paths = React.useMemo(() => {
    const polar = (r: number, deg: number) => {
      const θ = (deg - 90) * DEG2RAD; // 0° up; clockwise
      return [cx + r * Math.cos(θ), cy + r * Math.sin(θ)] as const;
    };
    const sectorPath = (r: number, a0: number, a1: number) => {
      const [x0, y0] = polar(r, a0);
      const [x1, y1] = polar(r, a1);
      const large = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0;
      return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
    };
    const scaleR = (c: number) => (max > 0 ? (c / max) * R : 0);
    return bins.map((b) => sectorPath(scaleR(b.count), b.start, b.end));
  }, [bins, max, R, cx, cy]);

  // Only compute active bin indices when the highlight angles change
  const hotSet = React.useMemo(() => {
    const n = Math.round(360 / Math.max(1, binSize));
    const s = new Set<number>();
    for (const a of highlightAngles) {
      if (a == null || Number.isNaN(a)) continue;
      const idx = Math.min(n - 1, Math.floor(wrap360(a) / binSize));
      s.add(idx);
    }
    return s;
  }, [highlightAngles, binSize]);

  return (
    <Card title={title} className="w-full">
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }}>
        {/* rings */}
        {Array.from({ length: ringCount }, (_, i) => {
          const rr = ((i + 1) / ringCount) * R;
          return (
            <circle
              key={rr}
              cx={cx}
              cy={cy}
              r={rr}
              fill="none"
              stroke={grid}
              strokeDasharray="2 6"
            />
          );
        })}
        {/* crosshair */}
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke={grid} />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke={grid} />
        {/* labels */}
        <text x={cx} y={cy - R - 6} textAnchor="middle" fill={axis} fontSize="10">N</text>
        <text x={cx + R + 6} y={cy + 3} fill={axis} fontSize="10">E</text>
        <text x={cx} y={cy + R + 12} textAnchor="middle" fill={axis} fontSize="10">S</text>
        <text x={cx - R - 6} y={cy + 3} textAnchor="end" fill={axis} fontSize="10">W</text>

        {/* sectors */}
        {bins.map((b, i) => {
          const hot = hotSet.has(i);
          return (
            <path
              key={b.start}
              d={paths[i]}
              fill={hot ? highlightColor : fill}
              fillOpacity={hot ? 0.95 : 0.55}
              stroke={hot ? highlightColor : fill}
              strokeOpacity={hot ? 1 : 0.9}
              strokeWidth={hot ? 2 : 0.5}
            />
          );
        })}
      </svg>
      <div className="mt-2 text-xs text-muted">
        Bin: {binSize}°, Samples: {angles.length.toLocaleString()}
      </div>
    </Card>
  );
});

/* ===================== Utils ===================== */
function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function pickSeries(ar: ApparentResult): ApparentPoint[] {
  return ar.series ?? ar.full ?? ar.points ?? ar.sample ?? ([] as ApparentPoint[]);
}
function normalizeSeries(ar: ApparentResult): SeriesDatum[] {
  const pts = pickSeries(ar);
  const out: SeriesDatum[] = [];

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const tNum = Date.parse(p.timestamp);
    let hdg = headingFromUV(p.boat_u_ms, p.boat_v_ms);
    if (hdg == null && i + 1 < pts.length) {
      const q = pts[i + 1];
      hdg = bearingFromLatLon(p.lat, p.lon, q.lat, q.lon);
    }
    const twd = p.wind_direction_10m_deg ?? null;
    const awa = p.awa_deg ?? null;
    const awaAbs = awa != null && hdg != null ? wrap360(hdg + awa) : null;

    out.push({
      t: new Date(tNum),
      tNum,
      awa,
      aws: p.apparent_wind_speed_ms ?? null,
      speed: p.speed_m_s ?? null,
      tws: p.wind_speed_10m_ms ?? null,
      heading: hdg,
      twd,
      awaAbs,
    });
  }
  return out;
}

const isNum = (v: any): v is number => v != null && !Number.isNaN(v);

/* ===================== App ===================== */
export default function App() {
  // sidebar controls
  const hp = useHoverPanel({ openDelay: 140, closeDelay: 420, minOpenMs: 260 });
  const PANEL_W = 280;
  const EDGE_W = 18;
  const isPanelActive = hp.open || hp.pinned;

  // data state
  const [file, setFile] = React.useState<File | null>(null);
  const [parsed, setParsed] = React.useState<ParseResult | null>(null);
  const [apparent, setApparent] = React.useState<ApparentResult | null>(null);
  const [loadingParse, setLoadingParse] = React.useState(false);
  const [loadingCompute, setLoadingCompute] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // hover (rAF throttled)
  type HoverAngles = { tNum?: number; hdg: number | null; twd: number | null; awaRel: number | null };
  const [hoverAngles, setHoverAngles] = React.useState<HoverAngles>({ tNum: undefined, hdg: null, twd: null, awaRel: null });
  const rafRef = React.useRef<number | null>(null);
  const pendingHoverRef = React.useRef<HoverAngles | null>(null);

  React.useEffect(() => {
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, []);

  const scheduleHoverUpdate = (next: HoverAngles) => {
    pendingHoverRef.current = next;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingHoverRef.current) setHoverAngles(pendingHoverRef.current);
    });
  };

  // chart theme tokens
  const chartAxis = "var(--color-chart-axis)";
  const chartGrid = "var(--color-chart-grid)";
  const chartLegend = "var(--color-chart-legend)";
  const c1 = "var(--color-chart-line-1)";
  const c2 = "var(--color-chart-line-2)";
  const c3 = "var(--color-chart-line-3)";

  // parse
  async function parseGpsFile(f: File): Promise<ParseResult | null> {
    setError(null);
    setLoadingParse(true);
    setApparent(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const resp = await fetch(`${BACKEND}/api/v1/parse-gps?return_full=true`, {
        method: "POST",
        body: form,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const j = (await resp.json()) as ParseResult;
      setParsed(j);
      return j;
    } catch (e: any) {
      setError(e?.message ?? String(e));
      return null;
    } finally {
      setLoadingParse(false);
    }
  }

  // compute
  async function computeApparent(pointsOverride?: ParsedPoint[]) {
    const points = pointsOverride ?? parsed?.points;
    if (!points?.length) return;
    setLoadingCompute(true);
    setError(null);
    try {
      const req = {
        coord_strategy: "centroid",
        source_preference: "auto",
        fetch_wind_if_missing: true,
        points,
      };
      const resp = await fetch(`${BACKEND}/api/v1/apparent-wind?return_full=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const j = (await resp.json()) as ApparentResult;
      setApparent(j);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoadingCompute(false);
    }
  }

  // file picker
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      (async () => {
        const parsedNow = await parseGpsFile(f);
        if (AUTO_COMPUTE_ON_BOOT && parsedNow?.points?.length) {
          await computeApparent(parsedNow.points);
        }
      })();
    }
  }

  // autoload sample
  React.useEffect(() => {
    if (!AUTO_LOAD_SAMPLE) return;
    (async () => {
      try {
        const r = await fetch(SAMPLE_URL);
        if (!r.ok) return;
        const blob = await r.blob();
        const f = new File([blob], "activity_20298293877.gpx", {
          type: blob.type || "application/gpx+xml",
        });
        setFile(f);
        const parsedNow = await parseGpsFile(f);
        if (AUTO_COMPUTE_ON_BOOT && parsedNow?.points?.length) {
          await computeApparent(parsedNow.points);
        }
      } catch {
        // ignore if not reachable
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // safety net: compute when parsed becomes ready
  React.useEffect(() => {
    if (AUTO_COMPUTE_ON_BOOT && parsed?.points?.length && !apparent && !loadingCompute) {
      computeApparent(parsed.points);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed]);

  const series = React.useMemo(() => (apparent ? normalizeSeries(apparent) : []), [apparent]);
  const dataReady = series.length > 0;

  /* --- Memoized angle arrays for roses --- */
  const headings = React.useMemo(
    () => series.map(s => s.heading).filter(isNum),
    [series]
  );
  const twdAngles = React.useMemo(
    () => series.map(s => s.twd).filter(isNum),
    [series]
  );
  const awaAnglesRel = React.useMemo(
    () => series.map(s => s.awa).filter(isNum).map(wrap360),
    [series]
  );

  /* Parse summary */
  const parseSummary =
    parsed && (
      <div className="text-xs text-muted">
        <span className="font-medium">{parsed.source}</span> •{" "}
        {parsed.points.length.toLocaleString()} pts • {parsed.start_time} → {parsed.end_time}
        {parsed.speed_was_derived ? (
          <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
            speed derived
          </span>
        ) : null}
      </div>
    );

  /* rAF-throttled hover handlers */
  const updateHoverFromState = (state?: any) => {
    if (!state || !state.isTooltipActive) {
      scheduleHoverUpdate({ tNum: undefined, hdg: null, twd: null, awaRel: null });
      return;
    }

    let p: SeriesDatum | undefined = state.activePayload?.[0]?.payload as SeriesDatum | undefined;

    if (!p && state.activeLabel != null) {
      const x = Number(state.activeLabel);
      if (!Number.isNaN(x) && series.length) {
        // nearest by time (binary search)
        let lo = 0, hi = series.length - 1, best = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (series[mid].tNum <= x) { best = mid; lo = mid + 1; }
          else { hi = mid - 1; }
        }
        p = series[best];
      }
    }

    if (p) {
      scheduleHoverUpdate({
        tNum: p.tNum,
        hdg: p.heading ?? null,
        twd: p.twd ?? null,
        awaRel: p.awa != null ? wrap360(p.awa) : null,
      });
    } else {
      scheduleHoverUpdate({ tNum: undefined, hdg: null, twd: null, awaRel: null });
    }
  };

  const clearHover = () => scheduleHoverUpdate({ tNum: undefined, hdg: null, twd: null, awaRel: null });

  return (
    <div className="min-h-screen w-full bg-base-900 text-base-100">
      {/* Hover edge — keeps the panel discoverable */}
      <div
        className="fixed inset-y-0 left-0"
        style={{
          width: EDGE_W,
          zIndex: 40,
          cursor: "ew-resize",
          pointerEvents: isPanelActive ? "none" : "auto",
        }}
        onPointerEnter={hp.scheduleOpen}
        onPointerLeave={hp.cancelOpen}
        aria-hidden
      />

      {/* Two-column grid so the panel PUSHES content */}
      <div
        className="min-h-screen grid"
        style={{
          gridTemplateColumns: `${isPanelActive ? PANEL_W : 0}px 1fr`,
          transition: "grid-template-columns 180ms ease",
        }}
      >
        {/* Sidebar */}
        <aside
          className="relative border-r border-border bg-[color:var(--color-panel)]"
          onPointerEnter={hp.scheduleOpen}
          onPointerLeave={hp.scheduleClose}
          style={{
            width: isPanelActive ? PANEL_W : 0,
            overflow: "hidden",
            transition: "width 180ms ease",
          }}
        >
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="i-lucide-settings h-4 w-4" />
              <span className="font-medium">Settings</span>
            </div>
            <button
              onClick={hp.togglePin}
              className="rounded border border-border px-2 py-1 text-xs hover:brightness-110"
              title={hp.pinned ? "Unpin" : "Pin"}
            >
              {hp.pinned ? "Unpin" : "Pin"}
            </button>
          </div>
          <div className="px-3 pb-4">
            <SideSettings />
          </div>
        </aside>

        {/* Main content */}
        <main className="w-full min-w-0 p-6 md:p-8 space-y-6">
          <h1 className="text-xl font-semibold">XBoat — Apparent Wind Demo</h1>

          {/* Controls */}
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-3">
              <input
                type="file"
                accept=".gpx,.tcx,.fit"
                onChange={onFileChange}
                className="hidden"
              />
              <span className="rounded-lg bg-[color:var(--color-panel)] border border-border shadow-soft px-3 py-2 text-sm cursor-pointer hover:brightness-110">
                Choose File
              </span>
              <span className="text-sm text-muted">
                {file ? file.name : "No file chosen"}
              </span>
            </label>

            <button
              onClick={() => computeApparent()}
              disabled={!parsed?.points?.length || loadingCompute}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingCompute ? "Computing…" : "Compute Apparent Wind"}
            </button>
          </div>

          {/* Parse summary */}
          <Card title="Parse summary">{parseSummary}</Card>

          {/* Charts */}
          <ChartSection title="AWA (°) — full series" dataReady={!!dataReady}>
            <LineChart
              data={series}
              margin={{ top: 14, right: 16, bottom: 10, left: 8 }}
              onMouseEnter={updateHoverFromState}
              onMouseMove={updateHoverFromState}
              onMouseLeave={clearHover}
            >
              <CartesianGrid stroke={chartGrid} strokeDasharray="2 6" />
              <XAxis
                dataKey="tNum"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                stroke={chartAxis}
                tick={{ fill: chartAxis }}
                tickFormatter={(value: number) => fmtTime(new Date(value))}
                allowDuplicatedCategory={false}
              />
              <YAxis
                domain={[-180, 180]}
                stroke={chartAxis}
                tick={{ fill: chartAxis }}
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
              <Legend wrapperStyle={{ color: chartLegend }} iconType="plainline" />
              {/* glow + main stroke */}
              <Line
                type="monotone"
                dataKey="awa"
                stroke={c1}
                strokeOpacity={0.25}
                strokeWidth={6}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="awa"
                name="AWA (deg)"
                stroke={c1}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartSection>

          <ChartSection title="Speeds (m/s) — full series" dataReady={!!dataReady}>
            <LineChart
              data={series}
              margin={{ top: 10, right: 16, bottom: 10, left: 8 }}
              onMouseEnter={updateHoverFromState}
              onMouseMove={updateHoverFromState}
              onMouseLeave={clearHover}
            >
              <CartesianGrid stroke={chartGrid} strokeDasharray="2 6" />
              <XAxis
                dataKey="tNum"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                stroke={chartAxis}
                tick={{ fill: chartAxis }}
                tickFormatter={(value: number) => fmtTime(new Date(value))}
                allowDuplicatedCategory={false}
              />
              <YAxis stroke={chartAxis} tick={{ fill: chartAxis }} />
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
              <Legend wrapperStyle={{ color: chartLegend }} iconType="plainline" />

              {/* glow layers */}
              <Line
                type="monotone"
                dataKey="aws"
                stroke={c1}
                strokeOpacity={0.2}
                strokeWidth={6}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="speed"
                stroke={c2}
                strokeOpacity={0.2}
                strokeWidth={6}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="tws"
                stroke={c3}
                strokeOpacity={0.2}
                strokeWidth={6}
                dot={false}
                isAnimationActive={false}
              />

              {/* main strokes */}
              <Line
                type="monotone"
                dataKey="aws"
                name="Apparent (m/s)"
                stroke={c1}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="speed"
                name="Boat (m/s)"
                stroke={c2}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="tws"
                name="True@10m (m/s)"
                stroke={c3}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartSection>

          <Card title="Compass Roses">
            <div className="grid gap-4 md:grid-cols-3">
              <CompassRose
                title="True Wind (bearing)"
                angles={twdAngles}
                binSize={15}
                highlightAngles={hoverAngles.twd != null ? [hoverAngles.twd] : []}
              />
              <CompassRose
                title="Boat Heading (bearing)"
                angles={headings}
                binSize={15}
                highlightAngles={hoverAngles.hdg != null ? [hoverAngles.hdg] : []}
              />
              <CompassRose
                title="Apparent Wind (relative to bow)"
                angles={awaAnglesRel}
                binSize={15}
                highlightAngles={hoverAngles.awaRel != null ? [hoverAngles.awaRel] : []}
              />
            </div>
          </Card>

          {error && (
            <Card title="Error">
              <pre className="whitespace-pre-wrap text-sm text-red-300">{error}</pre>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
