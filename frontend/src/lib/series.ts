import type { ApparentResult, SeriesPoint } from "../types/api";
import { bearingFromLatLon, headingFromUV, wrap360 } from "./math";

export function pickSeries(ar: ApparentResult) {
  return ar.series ?? ar.full ?? ar.points ?? ar.sample ?? [];
}

export function normalizeSeries(ar: ApparentResult): SeriesPoint[] {
  const pts = pickSeries(ar);
  const out: SeriesPoint[] = [];

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
