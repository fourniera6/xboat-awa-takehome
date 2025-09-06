import React, { useMemo } from 'react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { AWPoint } from '../types';

function bin(val:number, step=15){ // 24 bins -> 15°
  let x = Math.round(val/step)*step; if (x<=-180) x+=360; if (x>180) x-=360; return x;
}

export default function PolarAWARose({aw}:{aw:AWPoint[]}){
  const data = useMemo(()=>{
    const m = new Map<number, number>();
    for(const p of aw){ const b = bin(p.awa); m.set(b, (m.get(b)||0) + 1); }
    return [...m.entries()].map(([angle,count])=>({ angle, count }));
  },[aw]);
  return (
    <div className="bg-bg-soft rounded-2xl p-4">
      <div className="text-sm mb-2 opacity-70">AWA Distribution (port/starboard)</div>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="80%">
          <PolarGrid />
          <PolarAngleAxis dataKey="angle" tick={{fontSize:10}}/>
          <Radar dataKey="count" name="Time" fillOpacity={0.3} strokeWidth={1.5} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
