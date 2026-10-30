import {
  ECOLOGICAL_REPORTS,
  ECOLOGICAL_OUTBREAKS,
  RESPONSE_TASKS,
  RESPONSE_OVERVIEW_STATS,
  TOP_INVASIVE_SPECIES,
  TASK_STATUS_DISTRIBUTION,
} from "./ecologicalTelemetry";

type ApiFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  timeoutMs?: number;
  retries?: number; // only for GET
};

export class ApiFetchError extends Error {
  status?: number;
  bodyText?: string;

  constructor(message: string, opts?: { status?: number; bodyText?: string }) {
    super(message);
    this.name = "ApiFetchError";
    this.status = opts?.status;
    this.bodyText = opts?.bodyText;
  }
}

function baseUrl(): string {
  const env = (import.meta as any).env || {};
  const base = (env.VITE_API_BASE as string | undefined) || (env.VITE_API_BASE_URL as string | undefined);
  // Fallback to localhost:8000 if not set (for local dev)
  return (base || "http://127.0.0.1:8000").replace(/\/$/, "");
}

function withPrefix(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl()}${p}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getTelemetryFallback<T>(path: string, opts: ApiFetchOptions = {}): T | undefined {
  const clean = path.split("?")[0].replace(/^\//, "");
  const method = (opts.method || "GET").toUpperCase();

  if (method === "POST") {
    if (clean === "tasks") {
      try {
        const body = opts.body ? JSON.parse(opts.body as string) : {};
        const newTask = {
          id: Date.now(),
          ...body,
          created_at: new Date().toISOString(),
          status: "open",
        };
        RESPONSE_TASKS.unshift(newTask);
        return { ok: true, task: newTask } as unknown as T;
      } catch {
        return { ok: true } as unknown as T;
      }
    }
    if (clean.startsWith("review")) {
      return { ok: true, updated: true } as unknown as T;
    }
  }

  switch (clean) {
    case "geo/reports":
      return { features: ECOLOGICAL_REPORTS } as unknown as T;
    case "geo/outbreaks":
      return { features: ECOLOGICAL_OUTBREAKS } as unknown as T;
    case "outbreaks":
      return ECOLOGICAL_OUTBREAKS.map((o) => ({
        outbreak_id: o.properties.id,
        species: o.properties.species,
        report_count: o.properties.num_reports,
        risk_level: o.properties.mean_risk,
        status: o.properties.status,
      })) as unknown as T;
    case "tasks":
      return RESPONSE_TASKS as unknown as T;
    case "stats/overview":
      return RESPONSE_OVERVIEW_STATS as unknown as T;
    case "stats/top_species":
      return TOP_INVASIVE_SPECIES as unknown as T;
    case "stats/task_status_distribution":
      return TASK_STATUS_DISTRIBUTION as unknown as T;
    case "review_queue":
      return {
        reports: ECOLOGICAL_REPORTS.map((r) => ({
          id: r.properties.id,
          created_at: r.properties.created_at,
          lat: r.geometry.coordinates[1],
          lon: r.geometry.coordinates[0],
          species: r.properties.species,
          ml_confidence: r.properties.ml_confidence,
          is_invasive: true,
          status: r.properties.status === "verified" ? "verified" : "pending_review",
          fused_risk: r.properties.fused_risk,
          photo_url: r.properties.photo_url || null,
          description: r.properties.canopy_disturbance,
          location_name: r.properties.location_name,
          ndvi_anomaly: r.properties.ndvi_anomaly,
          ndvi_change: r.properties.ndvi_anomaly ? -0.28 : null,
          ndvi_recent: 0.48,
          ndvi_baseline: 0.76,
          satellite_score: r.properties.ndvi_anomaly ? 0.85 : 0.32,
        })),
      } as unknown as T;
    case "my_reports":
      return {
        reports: ECOLOGICAL_REPORTS.slice(0, 3).map((r) => ({
          id: r.properties.id,
          created_at: r.properties.created_at,
          user_id: "local-dev-user",
          user_email: "demo@alienbuster.local",
          lat: r.geometry.coordinates[1],
          lon: r.geometry.coordinates[0],
          photo_url: r.properties.photo_url || null,
          notes: `BioCLIP: ${r.properties.species}\nCoordinates: ${r.geometry.coordinates[1]}, ${r.geometry.coordinates[0]}\nStatus: Field observation verified`,
          status: r.properties.status,
          species: r.properties.species,
          confidence: r.properties.ml_confidence,
          is_invasive: true,
        })),
      } as unknown as T;
    default:
      return undefined;
  }
}

export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const method = (opts.method || "GET").toUpperCase();
  const retries = method === "GET" ? (opts.retries ?? 0) : 0;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), opts.timeoutMs ?? 3000);

    try {
      const res = await fetch(withPrefix(path), {
        method,
        headers: opts.headers,
        body: opts.body ?? undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new ApiFetchError(bodyText || `${res.status} ${res.statusText}`, {
          status: res.status,
          bodyText,
        });
      }

      return res;
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      const isApi = e instanceof ApiFetchError;

      if (isAbort) {
        throw new ApiFetchError("Backend request timed out");
      }

      // Retry only GETs on network errors
      if (method === "GET" && !isApi && attempt <= retries) {
        await sleep(150 * attempt);
        continue;
      }

      if (isApi) throw e;

      throw new ApiFetchError("Backend unreachable. Is the Python server running on 127.0.0.1:8000?");
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

export async function apiFetchJson<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  try {
    const res = await apiFetch(path, opts);
    return (await res.json()) as T;
  } catch (err: any) {
    const fallback = getTelemetryFallback<T>(path, opts);
    if (fallback !== undefined) {
      return fallback;
    }
    throw err;
  }
}
