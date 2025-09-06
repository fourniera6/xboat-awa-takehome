import React, { useEffect, useMemo, useState } from 'react';
import './styles/theme.css';
import ThemeToggle from './components/ThemeToggle';
import FileUpload from './components/FileUpload';
import SummaryCards from './components/SummaryCards';
import TimeSeries from './components/TimeSeries';
import PolarAWARose from './components/PolarAWARose';
import WindTriangle from './components/WindTriangle';
import { getSeries, getAW, getSummary } from './api/client';
import { HoverProvider, useHover } from './context/HoverContext';
import { AWPoint, Sample, Summary } from './types';

function Dashboard(){
  const [series, setSeries] = useState<Sample[]>([]);
  const [aw, setAw] = useState<AWPoint[]>([]);
  const [sum, setSum] = useState<Summary|null>(null);
  const { idx } = useHover();

  useEffect(()=>{ 
    const last = localStorage.getItem('last_track');
    if(last) onReady(last);
  },[]);

  async function onReady(trackId:string){
    localStorage.setItem('last_track', trackId);
    const s = await getSeries(trackId); setSeries(s.samples);
    const a = await getAW(trackId); setAw(a.aws);
    const m = await getSummary(trackId); setSum(m);
  }

  const tsData = useMemo(()=> series.map((p,i)=>({ t: i, speed: p.speed, aws: aw[i]?.aws ?? null })),[series,aw]);

  const current = useMemo(()=>{
    const i = idx ?? Math.floor(series.length/2);
    const p = series[i]; const a = aw[i];
    return p && a ? { speed: p.speed, heading: p.heading, ws: Math.abs(a.aws - a.head), wd: (a.awa + p.heading + 360)%360 } : null;
  },[idx, series, aw]);

  return (
    <div className="p-4 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Apparent Wind Explorer</h1>
        <div className="flex items-center gap-4">
          <FileUpload onReady={onReady}/>
          <ThemeToggle/>
        </div>
      </div>
      {sum && <SummaryCards s={sum}/>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TimeSeries data={tsData}/>
        <PolarAWARose aw={aw}/>
        {current && <WindTriangle sample={current}/>}
      </div>
    </div>
  );
}

export default function App(){
  return <HoverProvider><Dashboard/></HoverProvider>
}
