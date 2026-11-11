"use client";
// <Heartbeat state=.../>: the app's health as an ECG line, in Light and in Haunted.
// Beats while live, flat while dead. With prefers-reduced-motion it draws one still frame.
import { useEffect, useRef } from "react";
import { useHaunted } from "./gate";

export type Pulse = "building" | "deploying" | "repair" | "alive" | "dead";

const SIZE = 700;

// One PQRST complex, p in [0, 1).
function beat(p: number): number {
  const k = (c: number, w: number, h: number) => h * Math.exp(-((p - c) ** 2) / w);
  return k(0.18, 0.0012, 0.12) - k(0.3, 0.00012, 0.18) + k(0.33, 0.00018, 1) - k(0.37, 0.00015, 0.32) + k(0.6, 0.004, 0.22);
}

function sample(state: Pulse, t: number): number {
  const n = () => Math.random() - 0.5;
  if (state === "dead") return n() * 0.015;
  if (state === "alive") return beat((t % 70) / 70);
  if (state === "repair") return beat((t % 34) / 34) * 0.45 + n() * 0.04;
  return beat((t % 110) / 110) * 0.3 + n() * 0.03;
}

export function Heartbeat({ state, className }: { state: Pulse; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef<number[]>(new Array<number>(SIZE).fill(0));
  const t = useRef(0);
  const haunted = useHaunted();

  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const b = buf.current;
    const css = getComputedStyle(document.documentElement);
    const col = css.getPropertyValue(state === "dead" ? "--bad" : "--ecg").trim() || "#3ddc84";
    const grid = css.getPropertyValue("--line").trim() || "#ddd";
    const step = () => {
      b.shift();
      b.push(sample(state, ++t.current));
    };
    const draw = () => {
      const W = cv.width;
      const H = cv.height;
      g.clearRect(0, 0, W, H);
      g.strokeStyle = grid;
      g.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, H);
        g.stroke();
      }
      g.strokeStyle = col;
      g.lineWidth = haunted ? 2.6 : 2;
      g.shadowColor = col;
      g.shadowBlur = haunted ? 10 : 0;
      g.beginPath();
      b.forEach((v, i) => {
        const x = (i / (b.length - 1)) * W;
        const y = H * 0.62 - v * H * 0.55;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = col;
      g.beginPath();
      g.arc(W - 2, H * 0.62 - b[b.length - 1] * H * 0.55, 4, 0, 7);
      g.fill();
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (let i = 0; i < SIZE; i++) step();
      draw();
      return;
    }
    let raf = 0;
    const loop = () => {
      for (let i = 0; i < 4; i++) step();
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [state, haunted]);

  return (
    <canvas
      ref={ref}
      className={className}
      width={1400}
      height={140}
      role="img"
      aria-label={state === "dead" ? "Heartbeat: flat" : `Heartbeat: ${state}`}
      style={{ width: "100%", height: 70, display: "block" }}
    />
  );
}
