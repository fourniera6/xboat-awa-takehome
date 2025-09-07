import { useEffect, useRef, useState } from "react";

export function useRafState<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const frame = useRef<number | null>(null);
  const queued = useRef<T | null>(null);

  const set = (next: T) => {
    queued.current = next;
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (queued.current !== null) setState(queued.current);
    });
  };

  useEffect(() => () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
  }, []);

  return [state, set] as const;
}
