import { useEffect, useRef, useState } from "react";

export function useHoverPanel(opts?: {
  openDelay?: number;
  closeDelay?: number;
  minOpenMs?: number;
}) {
  const openDelay = opts?.openDelay ?? 140;
  const closeDelay = opts?.closeDelay ?? 420;
  const minOpenMs = opts?.minOpenMs ?? 260;

  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const lastOpenAt = useRef(0);
  const tOpen = useRef<number | null>(null);
  const tClose = useRef<number | null>(null);

  const clear = (h: number | null) => h && window.clearTimeout(h);

  const scheduleOpen = () => {
    if (pinned || open) return;
    clear(tClose.current);
    tOpen.current = window.setTimeout(() => {
      setOpen(true);
      lastOpenAt.current = performance.now();
    }, openDelay);
  };

  const cancelOpen = () => clear(tOpen.current);

  const scheduleClose = () => {
    if (pinned) return;
    clear(tOpen.current);
    const elapsed = performance.now() - lastOpenAt.current;
    const guard = Math.max(0, minOpenMs - elapsed);
    const wait = Math.max(closeDelay, guard);
    tClose.current = window.setTimeout(() => setOpen(false), wait);
  };

  const togglePin = () => {
    setPinned((p) => {
      const next = !p;
      if (next) {
        setOpen(true);
        lastOpenAt.current = performance.now();
      }
      return next;
    });
  };

  useEffect(() => () => {
    clear(tOpen.current);
    clear(tClose.current);
  }, []);

  return { open, pinned, scheduleOpen, cancelOpen, scheduleClose, togglePin };
}
