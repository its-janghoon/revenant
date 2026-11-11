"use client";
// Header switches: Light / Haunted, then (Haunted only) Full / Calm, then (Haunted Full only)
// Mute / Sound. CSS in tokens.css hides the ones that do not apply.
import { setCalm, setMode, setSound, useTheme } from "./state";

function Seg<T extends string>(p: { cls: string; label: string; value: T; items: [T, string][]; set: (v: T) => void }) {
  return (
    <div className={`seg ${p.cls}`} role="group" aria-label={p.label}>
      {p.items.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={p.value === v} onClick={() => p.set(v)}>{text}</button>
      ))}
    </div>
  );
}

export function ThemeSwitch() {
  const t = useTheme();
  return (
    <>
      <Seg cls="mode" label="Theme" value={t.mode} items={[["light", "Light"], ["haunted", "Haunted"]]} set={setMode} />
      <Seg cls="calm" label="Effects" value={t.calm ? "on" : "off"} items={[["off", "Full"], ["on", "Calm"]]} set={(v) => setCalm(v === "on")} />
      <Seg cls="snd" label="Sound" value={t.sound ? "on" : "off"} items={[["off", "Mute"], ["on", "Sound"]]} set={(v) => setSound(v === "on")} />
    </>
  );
}
