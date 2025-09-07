// frontend/src/services/parsing.ts
import { API_BASE } from "./api";
import type { ParseResult } from "../types/api";

export async function parseGpsFile(file: File): Promise<ParseResult> {
  const fd = new FormData();
  fd.append("file", file);

  // ask the API for the full trace
  const url = `${API_BASE}/api/v1/parse-gps?return_full=true`;

  const res = await fetch(url, {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Parse failed: ${res.status} ${text}`);
  }

  const json: any = await res.json();

  // --- Normalize fields so the rest of the app always has what it expects ---
  // Some implementations return `trace` instead of `points`. Map it.
  if (!json.points && Array.isArray(json.trace)) {
    json.points = json.trace;
  }

  // Ensure points is an array (even if empty)
  if (!Array.isArray(json.points)) json.points = [];

  // Make sure we have a friendly source label for the UI
  if (!json.source) json.source = file.name;

  return json as ParseResult;
}
