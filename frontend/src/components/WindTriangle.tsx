import React, { useEffect, useRef } from 'react';

function drawArrow(ctx:CanvasRenderingContext2D, x:number,y:number, dx:number,dy:number){
  const len = Math.hypot(dx,dy); if(len<1) return; const ux=dx/len, uy=dy/len;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dx,y+dy); ctx.stroke();
  const ah = 6; const aw = 3; // arrow head
  ctx.beginPath(); ctx.moveTo(x+dx,y+dy); ctx.lineTo(x+dx-ah*ux+aw*uy,y+dy-ah*uy-aw*ux); ctx.lineTo(x+dx-ah*ux-aw*uy,y+dy-ah*uy+aw*ux); ctx.closePath(); ctx.fill();
}

export default function WindTriangle({sample}:{sample:{speed:number; heading:number; ws:number; wd:number}}){
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const c = ref.current!; const ctx = c.getContext('2d')!; const W=c.width=280, H=c.height=240; ctx.clearRect(0,0,W,H);
    ctx.translate(W/2,H/2); ctx.scale(10,10); // 10 px per m/s
    ctx.lineWidth = 0.2; 
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg') || '#888';
    ctx.strokeStyle = fg; ctx.fillStyle = fg;
    // circle
    ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1;
    const toXY = (mag:number, deg:number)=>{ const r=(90-deg)*Math.PI/180; return [mag*Math.cos(r), mag*Math.sin(r)] as const };
    // vectors (global frame, towards directions)
    const [vbx,vby] = toXY(sample.speed, sample.heading);
    const awDirTow = ((90 - ( (sample.wd + 180) % 360 ))*Math.PI/180); // towards dir for ambient
    const [wx,wy] = [sample.ws*Math.cos(awDirTow), sample.ws*Math.sin(awDirTow)];
    const ax = wx - vbx; const ay = wy - vby;
    ctx.globalAlpha = 0.8; drawArrow(ctx,0,0, vbx, vby); // boat
    ctx.globalAlpha = 0.6; drawArrow(ctx,0,0, wx, wy);  // ambient
    ctx.globalAlpha = 1.0; ctx.lineWidth=0.3; drawArrow(ctx,0,0, ax, ay); // apparent
  },[sample]);
  return <div className="bg-bg-soft rounded-2xl p-4"><div className="text-sm mb-2 opacity-70">Wind Triangle</div><canvas ref={ref} width={280} height={240}/></div>
}
