import { useEffect } from "react";
import { parseGpsFile } from "../services/parsing";

/**
 * Load a sample GPX from a backend static route and hand it to a callback.
 * Pass `null` to disable.
 */
export function useAutoloadSample(
) {
  useEffect(() => {
  (async () => {
    try {
      const blob = await fetch("/activity_20298293877.gpx").then(r => r.blob());
      const file = new File([blob], "activity_20298293877.gpx", { type: "application/gpx+xml" });
      await parseGpsFile(file, true);
    } catch (e) {
      console.error(e);
    }
  })();
}, []);
}
