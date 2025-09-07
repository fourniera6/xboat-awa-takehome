import { useEffect } from "react";

/**
 * Load a sample GPX from a backend static route and hand it to a callback.
 * Pass `null` to disable.
 */
export function useAutoloadSample(
  sampleUrl: string | null,
  onReady: (file: File) => void
) {
  useEffect(() => {
    if (!sampleUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(sampleUrl);        // <-- GET only the static file
        if (!r.ok) return;                       // silently skip if not served
        const blob = await r.blob();
        if (cancelled) return;
        const f = new File([blob], sampleUrl.split("/").pop() || "sample.gpx", {
          type: blob.type || "application/gpx+xml",
        });
        onReady(f);                               // <-- your App.tsx calls parseGpsFile(f)
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [sampleUrl, onReady]);
}
