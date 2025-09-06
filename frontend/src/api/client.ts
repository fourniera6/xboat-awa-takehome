const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function uploadFile(f: File): Promise<string> {
  const fd = new FormData(); fd.append('file', f);
  const r = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
  const j = await r.json(); return j.track_id;
}
export async function processTrack(id: string) { await fetch(`${API}/api/tracks/${id}/process`, { method: 'POST' }); }
export async function getSeries(id: string) { const r = await fetch(`${API}/api/tracks/${id}/series`); return r.json(); }
export async function getAW(id: string) { const r = await fetch(`${API}/api/tracks/${id}/aw`); return r.json(); }
export async function getSummary(id: string) { const r = await fetch(`${API}/api/tracks/${id}/summary`); return r.json(); }
