// The haunt engine: one per page, mounted by <HauntLayer/>. Plain DOM, no React.
// Every effect checks active() first, so Light, Calm and reduced motion get nothing.
import { active, watch } from "./gate";
import * as sound from "./sound";

export type Els = {
  dark: HTMLDivElement;
  grain: HTMLCanvasElement;
  rain: HTMLCanvasElement;
  drips: HTMLDivElement;
  thunder: HTMLDivElement;
  bolt: SVGPathElement[];
  ghost: SVGSVGElement;
};

let els: Els | null = null;
let moved = false;
let dying = false;
let fx = 0;
let fy = 0;
let mx: number | null = null;
let my = 0;
let ghostAt: { x: number; y: number } | null = null;
const subs = new Set<() => void>();
const heard: { t: number; big: boolean; breath?: boolean }[] = [];

// Tombstone reads `moved` from here.
export const store = {
  subscribe(f: () => void) {
    subs.add(f);
    return () => void subs.delete(f);
  },
  moved: () => moved,
};
function setMoved(v: boolean) {
  if (moved === v) return;
  moved = v;
  subs.forEach((f) => f());
}

// Every thunder and breath since load (performance.now() ms), for sound.bake in the demo video.
export const strikes = () => heard.slice();

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const restart = (el: Element, ...cls: string[]) => {
  el.classList.remove(...cls);
  void (el as HTMLElement).getBoundingClientRect();
};
const pulse = (cls: string, ms: number) => {
  restart(document.body, cls);
  document.body.classList.add(cls);
  setTimeout(() => document.body.classList.remove(cls), ms);
};

function jag(x: number, y: number, toY: number, spread: number) {
  let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
  while (y < toY) {
    y += 3 + Math.random() * 8;
    x += (Math.random() - 0.5) * spread;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return { d, x };
}

function strike(big: boolean): void {
  if (!els || !active()) return;
  const main = jag(15 + Math.random() * 70, 0, 100, 9);
  els.bolt[0].setAttribute("d", main.d);
  els.bolt[1].setAttribute("d", jag(main.x * 0.9 + 5, 20 + Math.random() * 20, 60, 14).d);
  els.bolt[2].setAttribute("d", jag(main.x * 1.05, 40 + Math.random() * 20, 85, 14).d);
  restart(els.thunder, "strike", "big");
  els.thunder.classList.add(big ? "big" : "strike");
  pulse("rv-lit", big ? 600 : 380); // lightning lights the whole screen, past the flashlight
  if (big) pulse("rv-quake", 800);
  sound.boom(big);
  heard.push({ t: performance.now(), big });
}

// A human shadow, placed away from where the flashlight points. It shows only in the two
// white frames of the close strike, and the loop hides it once the flashlight reaches it.
function haunt(): void {
  if (!els) return;
  const g = els.ghost;
  const x = innerWidth * (fx < innerWidth / 2 ? 0.66 + Math.random() * 0.22 : 0.1 + Math.random() * 0.22);
  const y = innerHeight * (0.5 + Math.random() * 0.15);
  g.style.setProperty("--gx", `${x}px`);
  g.style.setProperty("--gy", `${y}px`);
  restart(g, "show", "gone");
  g.classList.add("show");
  ghostAt = { x, y };
  setTimeout(() => {
    ghostAt = null;
    g.classList.remove("show");
  }, 1500);
}

export function thunder(): void {
  strike(false);
}

export function bleed(): void {
  if (!els || !active()) return;
  const box = els.drips;
  box.classList.remove("gone");
  box.innerHTML = '<div class="rv-smear"></div>';
  for (let i = 0; i < 18; i++) {
    const d = document.createElement("div");
    d.className = "rv-drip";
    d.style.left = `${(Math.random() * 98).toFixed(1)}%`;
    d.style.setProperty("--w", `${(3 + Math.random() * 7).toFixed(1)}px`);
    d.style.setProperty("--h", `${(60 + Math.random() * 420) | 0}px`);
    d.style.setProperty("--t", `${(2.2 + Math.random() * 3.5).toFixed(2)}s`);
    d.style.setProperty("--d", `${(Math.random() * 1.2).toFixed(2)}s`);
    box.append(d);
  }
}

export function clot(): void {
  els?.drips.classList.add("gone");
}

// The death scare (Requirement 12.11). Call it when a deploy dies; append the failure log
// line when it resolves. In Light, Calm or reduced motion it resolves at once and does nothing.
//   1 silence: rain cut for ~1 s   2 delay: strike 2-4 s after the death
//   3 strike: white/black/white, quake, close crack   4 silhouette in the white frames
//   5 tombstone moved closer (during the black frame)   6 quiet breath as the line appears
export async function die(): Promise<void> {
  if (!active() || dying) return;
  dying = true;
  try {
    sound.hush(1000);
    await wait(2000 + Math.random() * 2000);
    if (!active()) return;
    haunt();
    strike(true);
    setTimeout(() => setMoved(true), 105);
    await wait(420);
    bleed();
    pulse("rv-dying", 2600); // red flash + shake
    sound.breath();
    heard.push({ t: performance.now(), big: false, breath: true });
  } finally {
    dying = false;
  }
}

// Back to life: blood dries, the tombstone returns to its place, one far thunder.
export function rise(): void {
  clot();
  setMoved(false);
  strike(false);
}

export function mount(e: Els, target: string): () => void {
  els = e;
  fx = innerWidth * 0.7;
  fy = innerHeight * 0.25;
  const gg = e.grain.getContext("2d");
  const rg = e.rain.getContext("2d");
  const img = gg?.createImageData(e.grain.width, e.grain.height);
  const fit = () => {
    e.rain.width = innerWidth;
    e.rain.height = innerHeight;
  };
  fit();
  const drops = Array.from({ length: 260 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    l: 10 + Math.random() * 22,
    v: 14 + Math.random() * 12,
  }));
  const move = (ev: MouseEvent) => {
    mx = ev.clientX;
    my = ev.clientY;
  };

  let frame = 0;
  let raf = 0;
  let was = false;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!active()) {
      if (was) rg?.clearRect(0, 0, e.rain.width, e.rain.height);
      was = false;
      return;
    }
    was = true;
    frame++;
    // film grain
    if (gg && img && frame % 3 === 0) {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = d[i + 1] = d[i + 2] = (Math.random() * 255) | 0;
        d[i + 3] = 255;
      }
      gg.putImageData(img, 0, 0);
    }
    // flashlight: follows the mouse; before any move it lights the active area
    let tx = innerWidth / 2;
    let ty = innerHeight / 3;
    if (mx !== null) {
      tx = mx;
      ty = my;
    } else {
      const r = document.querySelector(target)?.getBoundingClientRect();
      if (r) {
        tx = r.left + r.width / 2;
        ty = r.top + r.height / 2;
      }
    }
    fx += (tx - fx) * 0.08;
    fy += (ty - fy) * 0.08;
    e.dark.style.setProperty("--x", `${fx}px`);
    e.dark.style.setProperty("--y", `${fy}px`);
    if (ghostAt && Math.hypot(fx - ghostAt.x, fy - ghostAt.y) < 180) e.ghost.classList.add("gone");
    // rain
    if (rg) {
      rg.clearRect(0, 0, e.rain.width, e.rain.height);
      rg.strokeStyle = "rgba(200,205,215,.28)";
      rg.lineWidth = 1;
      rg.beginPath();
      for (const p of drops) {
        rg.moveTo(p.x, p.y);
        rg.lineTo(p.x - p.l * 0.18, p.y + p.l);
        p.y += p.v;
        p.x -= p.v * 0.18;
        if (p.y > e.rain.height) {
          p.y = -p.l;
          p.x = Math.random() * (e.rain.width + 200);
        }
      }
      rg.stroke();
    }
  };
  raf = requestAnimationFrame(loop);

  let storm = 0;
  const next = () => {
    storm = window.setTimeout(() => {
      strike(false);
      next();
    }, 9000 + Math.random() * 12000);
  };
  next();

  const unwatch = watch(sound.sync);
  sound.sync();
  const resume = () => sound.resume();
  addEventListener("pointerdown", resume, true);
  addEventListener("mousemove", move);
  addEventListener("resize", fit);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(storm);
    unwatch();
    removeEventListener("pointerdown", resume, true);
    removeEventListener("mousemove", move);
    removeEventListener("resize", fit);
    if (els === e) els = null;
  };
}
