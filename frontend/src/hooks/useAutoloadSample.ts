/**
 * Autoload a sample file from /public and hand it to the caller.
 * Pass `null` to disable.
 */
import { useEffect } from "react";

export function useAutoloadSample(
  samplePath: string | null,
  onReady: (file: File) => void
) {
  useEffect(() => {
    if (!samplePath) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(samplePath);
        if (!res.ok) throw new Error(`Failed to fetch ${samplePath}: ${res.status}`);
        if (cancelled) return;

        const blob = await fetch("/activity_20298293877.gpx").then(r => r.blob());
        const file = new File([blob], "activity_20298293877.gpx", { type: "application/gpx+xml" });

        // Hand the file back to the app. App will parse + compute.
        onReady(file);
      } catch (e) {
        // Keep this quiet in UI; devtools will show it.
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [samplePath, onReady]);
}
