import { api } from "./api";
import type { ApparentResult, ParsedPoint } from "../types/api";

export function computeApparent(points: ParsedPoint[]) {
  const body = {
    coord_strategy: "centroid",
    source_preference: "auto",
    fetch_wind_if_missing: true,
    points,
  };
  return api.postJson<ApparentResult>("/api/v1/apparent-wind?return_full=true", body);
}
