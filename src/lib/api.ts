const base = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;

export const API_BASE_URL = (base || "").replace(/\/$/, "");

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}
