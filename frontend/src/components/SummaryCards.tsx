import React from 'react';
import { Summary } from '../types';

export default function SummaryCards({s}:{s:Summary}){
  const card = 'bg-bg-soft rounded-2xl p-4 shadow';
  const fmt = (x:number)=> x.toFixed(2);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className={card}><div className="text-xs opacity-70">Median AWS</div><div className="text-xl">{fmt(s.median_aws)} m/s</div></div>
      <div className={card}><div className="text-xs opacity-70">Head %</div><div className="text-xl">{Math.round(s.pct_head*100)}%</div></div>
      <div className={card}><div className="text-xs opacity-70">Tail %</div><div className="text-xl">{Math.round(s.pct_tail*100)}%</div></div>
      <div className={card}><div className="text-xs opacity-70">Cross %</div><div className="text-xl">{Math.round(s.pct_cross*100)}%</div></div>
      <div className={card}><div className="text-xs opacity-70">HED</div><div className="text-xl">{fmt(s.hed_m)} m</div></div>
      <div className={card}><div className="text-xs opacity-70">Adj Split</div><div className="text-xl">{fmt(s.adj_avg_split_s_per_500 || 0)} s/500m</div></div>
    </div>
  );
}
