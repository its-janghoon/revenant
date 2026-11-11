"use client";
// Keeps a screen on live data: refetches while the tab is visible, faster while something runs.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export function usePoll<T>(url: string, initial: T, every: (d: T) => number) {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef({ every, data });
  ref.current = { every, data };

  const refresh = useCallback(async () => {
    try {
      const d = await api<T>(url);
      setData(d);
      setError(null);
      return d;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [url]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let stop = false;
    const tick = async () => {
      if (document.visibilityState === "visible") await refresh();
      if (!stop) t = setTimeout(tick, ref.current.every(ref.current.data));
    };
    t = setTimeout(tick, every(initial));
    const vis = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; clearTimeout(t); document.removeEventListener("visibilitychange", vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  return { data, setData, error, refresh };
}

/** Appends timeline events newer than the last one we have. */
export function useTimeline<E extends { at: string }>(projectId: string, initial: E[], fast: boolean) {
  const [events, setEvents] = useState<E[]>(initial);
  const last = useRef(initial[initial.length - 1]?.at ?? "");
  const fastRef = useRef(fast);
  fastRef.current = fast;

  const pull = useCallback(async () => {
    try {
      const q = last.current ? `?since=${encodeURIComponent(last.current)}` : "";
      const r = await api<{ events: E[] }>(`/api/projects/${projectId}/timeline${q}`);
      if (r.events.length) {
        last.current = r.events[r.events.length - 1]!.at;
        setEvents((x) => {
          const seen = new Set(x.map((e) => e.at));
          return [...x, ...r.events.filter((e) => !seen.has(e.at))];
        });
      }
    } catch {
      /* keep what we have */
    }
  }, [projectId]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let stop = false;
    const tick = async () => {
      if (document.visibilityState === "visible") await pull();
      if (!stop) t = setTimeout(tick, fastRef.current ? 2500 : 12000);
    };
    t = setTimeout(tick, 1500);
    return () => { stop = true; clearTimeout(t); };
  }, [pull]);

  return { events, pull };
}
