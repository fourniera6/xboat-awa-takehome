export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const TWO_PI = Math.PI * 2;

export const wrap360 = (d: number) => (d % 360 + 360) % 360;

/** Heading (0=N, clockwise) from ENU components: u=east, v=north */
export function headingFromUV(u?: number | null, v?: number | null): number | null {
  if (u == null || v == null) return null;
  // atan2(x=east, y=north) → bearing from north clockwise
  return wrap360(Math.atan2(u, v) * RAD2DEG);
}

/** Initial geodesic bearing (0=N, clockwise) between two lat/lon points */
export function bearingFromLatLon(
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
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return wrap360(Math.atan2(y, x) * RAD2DEG);
}

/**
 * Unwrap the current angle so it’s continuous relative to the previous one.
 * Both angles are in RADIANS. Returns the current angle shifted by ±2π
 * until it lies within ±π of the previous.
 */
export function unwrap(prevRad: number | null, currRad: number | null): number | null {
  if (currRad == null) return null;
  if (prevRad == null) return currRad;
  let x = currRad;
  while (x - prevRad > Math.PI)  x -= TWO_PI;
  while (x - prevRad < -Math.PI) x += TWO_PI;
  return x;
}