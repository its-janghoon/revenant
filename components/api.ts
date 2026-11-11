"use client";
// fetch for the screens: JSON in and out, errors carry the server's message, code and url.

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public url?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: init.signal,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const e = (data ?? {}) as { error?: string; code?: string; url?: string };
    if (res.status === 401 && e.code === "signin") window.location.href = "/signin";
    throw new ApiError(e.error ?? `Request failed (${res.status})`, res.status, e.code, e.url);
  }
  return data as T;
}

export const usd = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "--" : `$${n.toLocaleString("en-US", { minimumFractionDigits: n >= 1000 ? 0 : digits, maximumFractionDigits: n >= 1000 ? 0 : digits })}`;

export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function dur(s: number | null | undefined): string {
  if (s === null || s === undefined) return "--";
  const m = Math.floor(s / 60);
  return m ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
}
