export type Sample = { t: string; lat: number; lon: number; speed: number; heading: number };
export type AWPoint = { t: string; aws: number; awa: number; head: number; cross: number };
export type Summary = { duration_s: number; median_aws: number; pct_head: number; pct_tail: number; pct_cross: number; hed_m: number; adj_avg_split_s_per_500?: number };
