import { api } from "./api";
import type { ParseResult } from "../types/api";

export async function parseGpsFile(file: File): Promise<ParseResult> {
  const form = new FormData();
  form.append("file", file);
  return api.postForm<ParseResult>("/api/v1/parse-gps?return_full=true", form);
}
