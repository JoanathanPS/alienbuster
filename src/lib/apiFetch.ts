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

export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const method = (opts.method || "GET").toUpperCase();
  const retries = method === "GET" ? (opts.retries ?? 1) : 0;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);

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
      if (method === "GET" && !isApi && attempt <= retries + 1) {
        await sleep(250 * attempt);
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
  const res = await apiFetch(path, opts);
  return (await res.json()) as T;
}
