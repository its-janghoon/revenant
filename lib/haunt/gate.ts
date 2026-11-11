"use client";
// When effects may run: Haunted, Full (not Calm), and no prefers-reduced-motion.
// The theme module sets data-mode, data-calm and data-snd on <html>; this file only reads them.
import { useSyncExternalStore } from "react";

const html = () => document.documentElement;
let still: MediaQueryList | null = null;
const reduced = () => (still ??= matchMedia("(prefers-reduced-motion: reduce)")).matches;

export function active(): boolean {
  if (typeof document === "undefined") return false;
  const d = html().dataset;
  return d.mode === "haunted" && d.calm !== "on" && !reduced();
}

export function soundOn(): boolean {
  return active() && html().dataset.snd === "on";
}

export function haunted(): boolean {
  return typeof document !== "undefined" && html().dataset.mode === "haunted";
}

// Calls fn when mode, calm, sound or the motion setting changes.
export function watch(fn: () => void): () => void {
  const mo = new MutationObserver(fn);
  mo.observe(html(), { attributes: true, attributeFilter: ["data-mode", "data-calm", "data-snd"] });
  still ??= matchMedia("(prefers-reduced-motion: reduce)");
  still.addEventListener("change", fn);
  return () => {
    mo.disconnect();
    still?.removeEventListener("change", fn);
  };
}

export const useActive = () => useSyncExternalStore(watch, active, () => false);
export const useHaunted = () => useSyncExternalStore(watch, haunted, () => false);
