import React from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { useHover } from '../context/HoverContext';

export default function TimeSeries({data}:{data:any[]}){
  const { setIdx } = useHover();
  return (
    <div className="bg-bg-soft rounded-2xl p-4">
      <div className="text-sm mb-2 opacity-70">Timeseries: Speed vs Apparent Wind</div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} onMouseMove={(e)=> setIdx(e?.activeTooltipIndex ?? null)} onMouseLeave={()=>setIdx(null)}>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopOpacity={0.8}/><stop offset="95%" stopOpacity={0}/></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" hide/>
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip/>
          <Legend/>
          <Area yAxisId="left" type="monotone" dataKey="speed" name="Speed (m/s)" fillOpacity={0.3} fill="url(#g1)" strokeWidth={1.5} />
          <Area yAxisId="right" type="monotone" dataKey="aws" name="AWS (m/s)" fillOpacity={0.2} fill="url(#g1)" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
