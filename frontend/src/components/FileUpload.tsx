import React, { useRef } from 'react';
import { uploadFile, processTrack } from '../api/client';

export default function FileUpload({onReady}:{onReady:(id:string)=>void}){
  const ref = useRef<HTMLInputElement>(null);
  async function onChange(){
    if(!ref.current?.files?.[0]) return;
    const id = await uploadFile(ref.current.files[0]);
    await processTrack(id);
    onReady(id);
  }
  return (
    <div className="flex items-center gap-3">
      <input ref={ref} type="file" accept=".gpx,.tcx,.fit" onChange={onChange} className="text-sm" />
    </div>
  );
}
