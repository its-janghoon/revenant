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

export { ago, clock, dur, since, usd } from "./format";
