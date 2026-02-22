import { apiFetchJson, ApiFetchError } from "@/lib/apiFetch";

export type SystemStatus = {
  backend_ok: boolean;
  earth_engine_ok: boolean | null;
  alerts_enabled: boolean;
  version?: string;
};

export async function fetchSystemStatus(): Promise<SystemStatus> {
  // Prefer /status; fallback to /health
  try {
    return await apiFetchJson<SystemStatus>("/status", { timeoutMs: 5000 });
  } catch (e: any) {
    // If the backend is up but /status doesn't exist yet, fallback.
    try {
      const h = await apiFetchJson<any>("/health", { timeoutMs: 5000 });
      return {
        backend_ok: !!h?.ok,
        earth_engine_ok: null,
        alerts_enabled: false,
        version: h?.version,
      };
    } catch {
      if (e instanceof ApiFetchError) {
        return { backend_ok: false, earth_engine_ok: null, alerts_enabled: false };
      }
      return { backend_ok: false, earth_engine_ok: null, alerts_enabled: false };
    }
  }
}
