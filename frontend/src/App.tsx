import axios from "axios";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import SideSettings from "./components/SideSettings";
import { useTheme } from "./hooks/useTheme";

const API_BASE = "http://127.0.0.1:8000/api/v1";

type Point = {
  timestamp?: string;
  lat?: number; lon?: number;
  altitude_m?: number | null;
  speed_m_s?: number | null;
  heart_rate_bpm?: number | null;
  cadence_rpm?: number | null;
};
type ParseResp = {
  file_type: string; num_points: number; start_time?: string; end_time?: string;
  sample: Point[]; points?: Point[];
};
type ApparentPoint = Point & {
  course_deg?: number | null;
  wind_speed_10m_ms?: number | null;
  wind_direction_10m_deg?: number | null;
  apparent_wind_speed_ms?: number | null;
  apparent_wind_dir_deg?: number | null;
  awa_deg?: number | null;
};
type ApparentResp = {
  source?: string | null; mapped_count: number; start_time: string; end_time: string;
  sample: ApparentPoint[]; points?: ApparentPoint[];
};

function toLocalHM(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const { mode, isDark, setTheme } = useTheme();

  const [parsed, setParsed] = useState<ParseResp | null>(null);
  const [apparent, setApparent] = useState<ApparentResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const axis = isDark ? "#e5e7eb" : "#374151";
  const grid = isDark ? "#374151" : "#e5e7eb";

  const handleUpload = async (file: File) => {
    setError(null); setBusy(true); setApparent(null);
    try {
      const form = new FormData(); form.append("file", file);
      const { data } = await axios.post<ParseResp>(
        `${API_BASE}/parse-gps?return_full=true`, form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setParsed(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message);
    } finally { setBusy(false); }
  };

  const computeApparent = async () => {
    if (!parsed?.points) return;
    setError(null); setBusy(true);
    try {
      const body = {
        coord_strategy: "centroid", source_preference: "auto",
        fetch_wind_if_missing: true, min_speed_ms: 0.5,
        points: parsed.points,
      };
      const { data } = await axios.post<ApparentResp>(
        `${API_BASE}/apparent-wind?return_full=false`, body
      );
      setApparent(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message);
    } finally { setBusy(false); }
  };

  const chartData =
    apparent?.sample?.map(p => ({
      t: toLocalHM(p.timestamp),
      awa: p.awa_deg,
      speed: p.speed_m_s,
      aws: p.apparent_wind_speed_ms,
      tws: p.wind_speed_10m_ms
    })) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-neutral-900 dark:text-gray-100">
      <SideSettings mode={mode} isDark={isDark} setTheme={setTheme} />

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">XBoat — Apparent Wind Demo</h1>

        <div className="flex items-center gap-3">
          <input
            className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer
                       hover:file:bg-blue-500 dark:file:bg-blue-500 dark:hover:file:bg-blue-400"
            type="file"
            accept=".gpx,.tcx,.fit,application/gpx+xml"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            onClick={computeApparent}
            disabled={!parsed?.points || busy}
          >
            Compute Apparent Wind
          </button>
          {busy && <span className="text-sm text-gray-500 dark:text-gray-400">Working…</span>}
        </div>

        {error && <div className="text-red-600">{error}</div>}

        {parsed && (
          <div className="p-4 rounded shadow bg-white dark:bg-neutral-800">
            <div className="font-medium mb-2">Parse summary</div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {parsed.file_type.toUpperCase()} • {parsed.num_points} pts •{" "}
              {parsed.start_time} → {parsed.end_time}
            </div>
          </div>
        )}

        {apparent && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded shadow bg-white dark:bg-neutral-800">
              <div className="font-medium mb-2">AWA (°) — sample subset</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke={grid} strokeDasharray="3 3" />
                    <XAxis dataKey="t" stroke={axis} tick={{ fill: axis }} />
                    <YAxis domain={[-180, 180]} stroke={axis} tick={{ fill: axis }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="awa" name="AWA (deg)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 rounded shadow bg-white dark:bg-neutral-800">
              <div className="font-medium mb-2">Speeds (m/s) — sample subset</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke={grid} strokeDasharray="3 3" />
                    <XAxis dataKey="t" stroke={axis} tick={{ fill: axis }} />
                    <YAxis stroke={axis} tick={{ fill: axis }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="speed" name="Boat (m/s)" dot={false} />
                    <Line type="monotone" dataKey="aws" name="Apparent (m/s)" dot={false} />
                    <Line type="monotone" dataKey="tws" name="True@10m (m/s)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {!apparent && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload a file, then click “Compute Apparent Wind”. We visualize a subset (the API returns a <code>sample</code>).
          </p>
        )}
      </div>
    </div>
  );
}
