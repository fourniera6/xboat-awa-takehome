import React, { useLayoutEffect, useRef, useState } from "react";
import { ResponsiveContainer } from "recharts";
import { Card } from "./Card";

export function ChartSection({
  title,
  height = 340,
  dataReady,
  actions,
  children,
}: {
  title: string;
  height?: number;
  dataReady: boolean;
  actions?: React.ReactNode;
  children: React.ReactElement;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(cr.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const ready = dataReady && w > 0;

  return (
    <Card title={title} actions={actions} className="w-full">
      <div ref={ref} className="w-full" style={{ height }}>
        {ready ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-muted">
            {dataReady ? "Measuring layout…" : "Loading data…"}
          </div>
        )}
      </div>
    </Card>
  );
}
