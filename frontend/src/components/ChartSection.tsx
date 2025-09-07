import React, { useLayoutEffect, useRef, useState } from "react";
import {Card} from "./Card";

type Props = {
  title: string;
  height?: number;
  dataReady: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode; // can be a custom component now
};

export default function ChartSection({
  title,
  height = 340,
  dataReady,
  actions,
  children,
}: Props) {
  // Keep the “has size” guard so we never render charts into a 0×0 box.
  const ref = useRef<HTMLDivElement | null>(null);
  const [hasSize, setHasSize] = useState(false);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      const h = entries[0]?.contentRect.height ?? 0;
      setHasSize(w > 8 && h > 8);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const ready = dataReady && hasSize;

  return (
    <Card title={title} actions={actions} className="w-full">
      <div
        ref={ref}
        className="w-full"
        style={{ height, minHeight: height }}
      >
        {ready ? (
          // NOTE: children will include its own <ResponsiveContainer />
          children
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-muted">
            {dataReady ? "Measuring layout…" : "Loading data…"}
          </div>
        )}
      </div>
    </Card>
  );
}
