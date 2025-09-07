import { useEffect } from "react";
import { api } from "../services/api";

/**
 * Load a sample GPX from a backend static route and hand it to a callback.
 * Pass `null` to disable.
 */
export function useAutoloadSample(
  samplePath: string | null,
  onFile: (f: File) => void
) {
  useEffect(() => {
    if (!samplePath) return;
    (async () => {
      try {
        const blob = await api.getBlob(samplePath);
        const f = new File([blob], samplePath.split("/").pop() || "sample.gpx", {
          type: blob.type || "application/gpx+xml",
        });
        onFile(f);
      } catch {
        // ignore if not reachable
      }
    })();
  }, [samplePath, onFile]);
}
