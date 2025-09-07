import React, { useCallback, useMemo, useState } from "react";
import { AppShell } from "./AppShell";

import { Card } from "../components/Card";
import { CompassRose } from "../components/CompassRose";
import ChartSection from "../components/ChartSection";
import AWALineChart from "../components/charts/AWALineChart";
import SpeedsLineChart from "../components/charts/SpeedsLineChart";
import KpiCard, { fmtSplit } from "../components/KpiCard";
import { computeKPIs } from "../lib/metrics";

import { useRafState } from "../hooks/useRafState";
import { useAutoloadSample } from "../hooks/useAutoloadSample";

import { normalizeSeries } from "../lib/series";
import { wrap360 } from "../lib/math";

import { computeApparent } from "../services/apparent";
import { parseGpsFile } from "../services/parsing";
import { API_BASE } from "../services/api";

import type { ApparentResult, ParseResult, SeriesPoint } from "../types/api";

// env flags
const AUTO_LOAD_SAMPLE =
  (import.meta as any).env?.VITE_AUTO_LOAD_SAMPLE !== "false"; // default true
const AUTO_COMPUTE_ON_BOOT =
  (import.meta as any).env?.VITE_AUTO_COMPUTE_ON_BOOT !== "false"; // default true

// default sample path should match the file you serve at frontend/public/
const SAMPLE_PATH =
  (import.meta as any).env?.VITE_SAMPLE_GPX_PATH ?? "/activity_20298293877.gpx";

export default function App() {
  // core data
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [apparent, setApparent] = useState<ApparentResult | null>(null);
  const [, setLoadingCompute] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // hover index (rAF throttled)
  const [hoverIdx, setHoverIdx] = useRafState<number | null>(null);

  // series
  const series: SeriesPoint[] = useMemo(
    () => (apparent ? normalizeSeries(apparent) : []),
    [apparent]
  );
  const dataReady = series.length > 0;

  // KPIs input
  const kpis = useMemo(() => {
    const inputs = series.map((s) => ({
      tNum: s.tNum,
      speed: s.speed ?? 0,
      aws: s.aws ?? 0,
      awa: s.awa ?? 0,
      heading: s.heading ?? null,
    }));
    return computeKPIs(inputs, {
      headGain: 0.25,
      cscScaleM: 8,
      hedScale: 0.05,
    });
  }, [series]);

  // roses data
  const headings = useMemo(
    () => series.map((s) => s.heading).filter((v): v is number => v != null),
    [series]
  );
  const twdAngles = useMemo(
    () => series.map((s) => s.twd).filter((v): v is number => v != null),
    [series]
  );
  const awaRelAngles = useMemo(
    () => series.map((s) => s.awa).filter((v): v is number => v != null).map(wrap360),
    [series]
  );

  const hovered = hoverIdx != null ? series[hoverIdx] : null;
  const highlightTwd = hovered?.twd ?? null;
  const highlightHdg = hovered?.heading ?? null;
  const highlightAwaRel = hovered?.awa != null ? wrap360(hovered.awa) : null;

  // single, shared file-processing pipeline (used by both autoload + manual upload)
  const processFile = useCallback(async (f: File) => {
    setError(null);
    setFile(f);
    try {
      const p = await parseGpsFile(f); // hits /api/v1/parse-gps?return_full=true
      setParsed(p);

      // prefer full trace if present; fall back to 0
      const total = (p as any)?.num_points ?? p.points?.length ?? 0;

      if (AUTO_COMPUTE_ON_BOOT && total > 0 && p.points && p.points.length) {
        setLoadingCompute(true);
        const ar = await computeApparent(p.points); // hits /api/v1/apparent-wind
        setApparent(ar);
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoadingCompute(false);
    }
  }, []);

  // handlers
  const onChartHover = useCallback((idx: number | null) => setHoverIdx(idx), [setHoverIdx]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] || null;
      if (f) void processFile(f);
    },
    [processFile]
  );

  // autoload sample at boot (served statically by nginx from /frontend/public)
  useAutoloadSample(AUTO_LOAD_SAMPLE ? SAMPLE_PATH : null, processFile);

  // parse summary (render-safe)
  const parseSummary =
    parsed && (
      <div className="text-xs text-muted">
        <span className="font-medium">
          {(parsed as any).source ?? (parsed as any).file_type ?? "trace"}
        </span>
        {" • "}
        {((parsed.points?.length ?? (parsed as any).num_points ?? 0).toLocaleString())} pts
        {" • "}
        {parsed.start_time} → {parsed.end_time}
        {parsed.speed_was_derived ? (
          <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
            speed derived
          </span>
        ) : null}
        <span className="ml-3 opacity-70">API: {API_BASE}</span>
      </div>
    );

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">XBoat — Apparent Wind Demo</h1>

      {/* controls */}
      <div className="flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-3">
          <input type="file" accept=".gpx,.tcx,.fit" onChange={onFileChange} className="hidden" />
          <span className="rounded-lg bg-[color:var(--color-panel)] border border-border shadow-soft px-3 py-2 text-sm cursor-pointer hover:brightness-110">
            Choose File
          </span>
          <span className="text-sm text-muted">{file ? file.name : "No file chosen"}</span>
        </label>
      </div>

      <Card title="Parse summary">{parseSummary}</Card>

      <Card title="Session KPIs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="HED (extra meters paid to wind)"
            value={Math.round(kpis.hed_m)}
            unit="m"
            hint={`k = 5% • raw = ${Math.round(kpis.hed_m)} m (∫ max(0, AWS·cos(AWA)) dt)`}
          />
          <KpiCard
            label="Crosswind Steering Cost"
            value={Math.round(kpis.csc_m)}
            unit="m (proxy)"
            hint="k · ∫ |A⊥|·|dθ/ds| dt, k=8 m"
            emphasize
          />
          <KpiCard
            label="Adjusted Split (still-air)"
            value={fmtSplit(kpis.split_adj_s)}
            hint={`Observed: ${fmtSplit(kpis.split_obs_s)} (${kpis.split_delta_s >= 0 ? "+" : ""}${kpis.split_delta_s.toFixed(
              1
            )} s)`}
            emphasize
          />
        </div>
      </Card>

      {/* AWA */}
      <ChartSection title="AWA (°) — full series" dataReady={dataReady}>
        <AWALineChart data={series} onHover={onChartHover} />
      </ChartSection>

      {/* Speeds */}
      <ChartSection title="Speeds (m/s) — full series" dataReady={dataReady}>
        <SpeedsLineChart data={series} onHover={onChartHover} />
      </ChartSection>

      {/* Roses */}
      <Card title="Compass Roses">
        <div className="grid gap-4 md:grid-cols-3">
          <CompassRose
            title="True Wind (bearing)"
            angles={twdAngles}
            binSize={15}
            highlightAngles={highlightTwd != null ? [highlightTwd] : []}
          />
          <CompassRose
            title="Boat Heading (bearing)"
            angles={headings}
            binSize={15}
            highlightAngles={highlightHdg != null ? [highlightHdg] : []}
          />
          <CompassRose
            title="Apparent Wind (relative to bow)"
            angles={awaRelAngles}
            binSize={15}
            highlightAngles={highlightAwaRel != null ? [highlightAwaRel] : []}
          />
        </div>
      </Card>

      {error && (
        <Card title="Error">
          <pre className="whitespace-pre-wrap text-sm text-red-300">{error}</pre>
        </Card>
      )}
    </AppShell>
  );
}
