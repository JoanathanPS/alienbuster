import { apiFetch, apiFetchJson, ApiFetchError } from "@/lib/apiFetch";

const env = (import.meta as any).env || {};
const base = (env.VITE_API_BASE as string | undefined) || (env.VITE_API_BASE_URL as string | undefined);

export const API_BASE_URL = (base || "").replace(/\/$/, "");

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

// Required by spec: robust apiFetch helpers
export { apiFetch, apiFetchJson, ApiFetchError };
