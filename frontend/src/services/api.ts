export const API_BASE =
  String((import.meta as any).env?.VITE_API_BASE_URL ?? "http://127.0.0.1:8000")
    .replace(/\/+$/,'')        // trim trailing slash(es)
    .replace(/^\/api$/,'');    // if base is exactly "/api", make it empty to avoid "/api/api/..."


async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Dev-time guard: /parse-gps must be POST
  if (import.meta.env.DEV) {
    const method = (init?.method ?? "GET").toUpperCase();
    if (path.startsWith("/api/v1/parse-gps") && method !== "POST") {
      throw new Error(`parse-gps must be POST, got ${method} ${path}`);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  postJson: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
  getBlob: async (path: string) => {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    return res.blob();
  },
};
