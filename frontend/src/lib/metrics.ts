import { unwrap } from "./math";

const DEG2RAD = Math.PI / 180;

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

export type SeriesPointInput = {
  tNum: number;            // ms epoch
  speed: number | null;    // m/s
  aws: number | null;      // m/s (apparent wind speed)
  awa: number | null;      // deg (apparent wind angle, +starboard / -port)
  heading: number | null;  // deg (boat bearing)
};

export type KPIs = {
  hed_m: number;           // meters “paid to headwind”
  csc_m: number;           // proxy meters for crosswind steering cost
  split_obs_s: number;     // observed split (s/500m)
  split_adj_s: number;     // adjusted split (still-air)
  split_delta_s: number;   // adj − obs (s)
};

/**
 * Reverted/robust KPIs:
 * - HED unchanged (∫ max(0, AWS·cos(AWA)) dt)
 * - CSC reverted to k * |A⊥| * |Δψ|/Δs * dt with guards
 * - Adjusted split reverted to v_adj = clip(v + k·A∥, 0.9v, 1.1v), then integrate distance
 */
export function computeKPIs(
  rows: SeriesPointInput[],
  opts: {
    headGain?: number;   // for adjusted split
    cscScaleM?: number;  // for CSC proxy
    hedScale?: number;   // NEW: scale for HED
    hedScaleM?: number;  // (compat alias)
  } = {}
): KPIs {
  if (!rows?.length) {
    return {
      hed_m: 0,
      csc_m: 0,
      split_obs_s: NaN,
      split_adj_s: NaN,
      split_delta_s: NaN,
    };
  }

  // Tunables (same as before)
  const headGain = opts.headGain ?? 0.25; // k for adjusted split
  const kCsc = opts.cscScaleM ?? 8;       // meters scale for CSC
  const hedScale = opts.hedScale ?? opts.hedScaleM ?? .05;  // NEW

  let hed_m = 0;
  let csc_m = 0;

  let distObs = 0;  // Σ v dt
  let distAdj = 0;  // Σ v_adj dt
  let tTotal = 0;   // Σ dt

  // heading unwrap state (radians)
  let prevHdg: number | null =
    rows[0].heading != null ? rows[0].heading * DEG2RAD : null;

  let prevT = rows[0].tNum;

  for (let i = 1; i < rows.length; i++) {
    const p = rows[i];
    const t = p.tNum;

    // dt in seconds with guards (ignore absurd gaps)
    let dt = (t - prevT) / 1000;
    if (!(dt > 0) || dt > 5) {
      prevT = t;
      // keep prevHdg as-is; skip this sample
      continue;
    }
    tTotal += dt;

    const v = p.speed ?? 0; // m/s

    const aws = p.aws;
    const awaRad = p.awa != null ? p.awa * DEG2RAD : null;

    // Observed distance
    distObs += v * dt;

    // --- HED (unchanged): ∫ max(0, AWS·cos(AWA)) dt ---
    if (aws != null && awaRad != null) {
      const ahead = Math.max(0, aws * Math.cos(awaRad)); // m/s
      hed_m += hedScale * ahead * dt;                                // m
    }

    // --- Crosswind Steering Cost (reverted & guarded) ---
    // proxy: k · |A⊥| · |Δψ|/Δs · dt
    // where Δψ is unwrapped heading change (rad) and Δs = v·dt (m).
    if (aws != null && awaRad != null && v > 0.3) {
      const aperp = Math.abs(aws * Math.sin(awaRad)); // m/s
      const hdgCurr = p.heading != null ? p.heading * DEG2RAD : null;
      const uHdg = unwrap(prevHdg, hdgCurr); // radians, continuous

      if (prevHdg != null && uHdg != null) {
        // cap per-step heading change to tame GPS jitter (≈ 14°/step)
        const dPsi = Math.min(Math.abs(uHdg - prevHdg), 0.25); // rad
        const ds = v * dt;                                     // m

        // ignore near-zero distance or big pauses
        if (ds > 0.5) {
          const kappa = dPsi / ds;                 // 1/m
          csc_m += kCsc * aperp * kappa * dt;      // m (proxy)
        }
        prevHdg = uHdg;
      } else {
        prevHdg = hdgCurr ?? prevHdg;
      }
    }

    // --- Adjusted Split (reverted style) ---
    // v_adj = clip(v + k·A∥, 0.9v, 1.1v) ; integrate distance over same time
    if (aws != null && awaRad != null) {
      const aheadSigned = aws * Math.cos(awaRad); // +head, -tail
      const vAdj = clamp(v + headGain * aheadSigned, v * 0.9, v * 1.1);
      distAdj += vAdj * dt;
    } else {
      distAdj += v * dt;
    }

    prevT = t;
  }

  const split_obs_s = distObs > 0 ? (500 * tTotal) / distObs : NaN;
  const split_adj_s = distAdj > 0 ? (500 * tTotal) / distAdj : NaN;
  const split_delta_s =
    isFinite(split_adj_s) && isFinite(split_obs_s)
      ? split_adj_s - split_obs_s
      : NaN;

  return { hed_m, csc_m, split_obs_s, split_adj_s, split_delta_s };
}
