/** The one place that talks to the backend: base URL, query strings, JSON, and error shaping. */

// Empty by default: the Vite dev server proxies the API paths (see vite.config.ts).
// Set VITE_API_URL to call a deployed backend directly (it must allow CORS).
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

function queryString(params?: Record<string, QueryValue>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined) continue;
    q.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** FastAPI errors: `detail` is a string, a list of validation errors, or an object (e.g. stock shortages). */
function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => (d as { msg?: string }).msg ?? "Invalid request").join("; ");
  if (detail && typeof detail === "object") {
    const d = detail as { detail?: string; short?: { ingredient: string }[] };
    const short = d.short?.map((s) => s.ingredient).join(", ");
    return [d.detail, short].filter(Boolean).join(": ") || fallback;
  }
  return fallback;
}

interface RequestOptions {
  params?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(method: string, path: string, { params, body, signal }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${queryString(params)}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(0, "Can't reach the bakery API. Is the backend running on port 8000?");
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(payload, res.statusText || `Request failed (${res.status})`), payload);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>("POST", path, { ...options, body }),
};
