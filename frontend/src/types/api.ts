// Shared API + normalized series types

export type ParsedPoint = {
  timestamp: string;
  lat?: number;
  lon?: number;
  altitude_m?: number | null;
  speed_m_s?: number | null;
  heart_rate_bpm?: number | null;
  cadence_rpm?: number | null;

  // optional boat vectors
  boat_u_ms?: number | null;
  boat_v_ms?: number | null;
};

export type ParseResult = {
  source: string;
  points: ParsedPoint[];
  start_time?: string;
  end_time?: string;
  speed_was_derived?: boolean;
};

export type ApparentPoint = ParsedPoint & {
  wind_speed_10m_ms?: number | null;
  wind_direction_10m_deg?: number | null;
  awa_deg?: number | null;
  apparent_wind_speed_ms?: number | null;
};

export type ApparentResult = {
  mapped_count?: number;
  start_time?: string;
  end_time?: string;
  sample?: ApparentPoint[];
  points?: ApparentPoint[];
  series?: ApparentPoint[];
  full?: ApparentPoint[];
};

export type SeriesPoint = {
  t: Date;
  tNum: number;
  awa: number | null;        // relative AWA in deg (±180)
  aws: number | null;        // apparent wind speed (m/s)
  speed: number | null;      // boat speed (m/s)
  tws: number | null;        // true wind @10m (m/s)
  heading: number | null;    // boat heading (bearing deg 0..360)
  twd: number | null;        // true wind direction (bearing 0..360)
  awaAbs: number | null;     // absolute apparent wind bearing (0..360)
};
