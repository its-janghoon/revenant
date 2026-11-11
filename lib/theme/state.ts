"use client";
// Read and set the theme attributes on <html>. lib/haunt watches the same attributes.
import { useSyncExternalStore } from "react";
import { KEYS } from "./script";
import type { Mode } from "./copy";

export interface Theme { mode: Mode; calm: boolean; sound: boolean }
const SERVER: Theme = { mode: "light", calm: false, sound: false };

let cache: Theme = SERVER;
function read(): Theme {
  const d = document.documentElement.dataset;
  const next: Theme = { mode: d.mode === "haunted" ? "haunted" : "light", calm: d.calm === "on", sound: d.snd === "on" };
  if (next.mode !== cache.mode || next.calm !== cache.calm || next.sound !== cache.sound) cache = next;
  return cache;
}
function watch(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "data-calm", "data-snd"] });
  return () => mo.disconnect();
}

export const useTheme = () => useSyncExternalStore(watch, read, () => SERVER);

function save(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* private mode: keep it for this page only */ }
}
export function setMode(mode: Mode) {
  document.documentElement.dataset.mode = mode;
  save(KEYS.mode, mode);
  if (mode === "light") document.documentElement.dataset.snd = "off";
}
export function setCalm(calm: boolean) {
  document.documentElement.dataset.calm = calm ? "on" : "off";
  save(KEYS.calm, calm ? "on" : "off");
  if (calm) document.documentElement.dataset.snd = "off";
}
/** Must be called from a click: browsers only start audio after a user gesture. */
export function setSound(sound: boolean) {
  document.documentElement.dataset.snd = sound ? "on" : "off";
}
