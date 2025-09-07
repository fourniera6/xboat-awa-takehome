import { API_BASE } from "./api";


export async function parseGpsFile(file: File, returnFull = true) {
  const form = new FormData();
  form.append("file", file, file.name); // <-- field name must be exactly "file"

  const res = await fetch(`${API_BASE}/api/v1/parse-gps?return_full=${returnFull ? "true" : "false"}`, {
    method: "POST",
    body: form,           // <-- let the browser set the multipart boundary
    // DO NOT set headers: { "Content-Type": ... }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`parse-gps failed: ${res.status} ${res.statusText} — ${text}`);
  }
  return res.json();
}