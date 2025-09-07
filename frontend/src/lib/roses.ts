export type RoseBin = { start: number; end: number; count: number; center: number };

export function roseBins(anglesDeg: number[], binSize = 15): { bins: RoseBin[]; max: number } {
  const size = Math.max(1, binSize);
  const n = Math.round(360 / size);
  const bins: RoseBin[] = Array.from({ length: n }, (_, i) => {
    const start = i * size;
    const end = start + size;
    const center = start + size / 2;
    return { start, end, center, count: 0 };
  });

  for (const a of anglesDeg) {
    if (a == null || Number.isNaN(a)) continue;
    const x = ((a % 360) + 360) % 360;
    const idx = Math.min(n - 1, Math.floor(x / size));
    bins[idx].count += 1;
  }

  const max = bins.reduce((m, b) => Math.max(m, b.count), 0);
  return { bins, max };
}

export function binIndex(angle: number, binSize = 15): number {
  const x = ((angle % 360) + 360) % 360;
  const n = Math.round(360 / Math.max(1, binSize));
  return Math.min(n - 1, Math.floor(x / binSize));
}
