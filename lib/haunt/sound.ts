// Storm sound made in the browser: no files, no licences.
// Silent until data-snd="on" (the user pressed Sound) and effects are active.
import { soundOn } from "./gate";

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let rainGain: GainNode | null = null;
let hushUntil = 0;

const quiet = () => performance.now() < hushUntil;

function noise(ctx: BaseAudioContext, sec: number, brown: boolean): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * sec), ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return b;
}

// Rain: looping band-limited white noise with slow gusts. Returns the level gain.
function rainBed(ctx: BaseAudioContext, dest: AudioNode, level: number): GainNode {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, 4, false);
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 7000;
  const gust = ctx.createGain();
  gust.gain.value = 1;
  const osc = ctx.createOscillator();
  const amt = ctx.createGain();
  osc.frequency.value = 0.09;
  amt.gain.value = 0.35;
  osc.connect(amt).connect(gust.gain);
  osc.start();
  const g = ctx.createGain();
  g.gain.value = level;
  src.connect(hp).connect(lp).connect(gust).connect(g).connect(dest);
  src.start();
  return g;
}

// One droplet on the roof.
function drop(ctx: BaseAudioContext, dest: AudioNode, t: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(1800 + Math.random() * 2600, t);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.05);
  g.gain.setValueAtTime(0.025 * Math.random() + 0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.07);
}

// Thunder: a high crack, then a low rumble. big = the close strike.
function crack(ctx: BaseAudioContext, dest: AudioNode, big: boolean, t: number): void {
  const c = ctx.createBufferSource();
  c.buffer = noise(ctx, 0.4, false);
  const cf = ctx.createBiquadFilter();
  cf.type = "highpass";
  cf.frequency.value = 1200;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(big ? 1 : 0.35, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.35 : 0.2));
  c.connect(cf).connect(cg).connect(dest);
  c.start(t);
  const r = ctx.createBufferSource();
  r.buffer = noise(ctx, big ? 6 : 4.5, true);
  const rf = ctx.createBiquadFilter();
  rf.type = "lowpass";
  rf.frequency.setValueAtTime(big ? 900 : 500, t);
  rf.frequency.exponentialRampToValueAtTime(80, t + (big ? 5 : 3.8));
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, t);
  rg.gain.exponentialRampToValueAtTime(big ? 2.4 : 1.1, t + 0.08);
  rg.gain.exponentialRampToValueAtTime(0.001, t + (big ? 5.5 : 4));
  r.connect(rf).connect(rg).connect(dest);
  r.start(t);
}

// A very quiet breath: in, a short hold, out.
function breathe(ctx: BaseAudioContext, dest: AudioNode, t: number): void {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx, 3, false);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(700, t);
  bp.frequency.linearRampToValueAtTime(1100, t + 0.9);
  bp.frequency.linearRampToValueAtTime(600, t + 2.8);
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.018, t + 0.9);
  g.gain.linearRampToValueAtTime(0.003, t + 1.3);
  g.gain.linearRampToValueAtTime(0.024, t + 1.7);
  g.gain.linearRampToValueAtTime(0, t + 2.9);
  s.connect(bp).connect(g).connect(dest);
  s.start(t);
  s.stop(t + 3);
}

function start(): void {
  if (ac) {
    void ac.resume();
    return;
  }
  ac = new AudioContext();
  master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);
  rainGain = rainBed(ac, master, 0);
  const loop = () => {
    if (ac && master && soundOn() && !quiet()) drop(ac, master, ac.currentTime);
    setTimeout(loop, 20 + Math.random() * 90);
  };
  loop();
}

function level(): void {
  if (!ac || !rainGain) return;
  const q = quiet();
  rainGain.gain.setTargetAtTime(soundOn() && !q ? 0.13 : 0, ac.currentTime, q ? 0.03 : 0.4);
}

// Follow data-snd / mode / calm. Called on every theme change.
export function sync(): void {
  if (soundOn()) start();
  level();
}

// Browsers keep audio suspended until a user gesture.
export function resume(): void {
  if (ac && soundOn()) void ac.resume();
}

// Cut the rain (and droplets) to zero for ms.
export function hush(ms: number): void {
  hushUntil = performance.now() + ms;
  level();
  setTimeout(level, ms + 10);
}

// Light comes first; a far thunder sounds 0.3-1 s later, the close strike at once.
export function boom(big: boolean): void {
  if (!ac || !master || !soundOn()) return;
  crack(ac, master, big, ac.currentTime + (big ? 0 : 0.3 + Math.random() * 0.7));
}

export function breath(): void {
  if (ac && master && soundOn()) breathe(ac, master, ac.currentTime);
}

export type Strike = { at: number; big: boolean; breath?: boolean };

// Render the same storm offline for the demo video. events: seconds from the start.
// Returns a 16-bit mono WAV.
export async function bake(events: Strike[], dur: number): Promise<ArrayBuffer> {
  const sr = 44100;
  const off = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
  const out = off.createGain();
  out.gain.value = 0.9;
  out.connect(off.destination);
  rainBed(off, out, 0.13);
  for (let t = 0; t < dur; t += 0.02 + Math.random() * 0.09) drop(off, out, t);
  for (const e of events) {
    if (e.breath) breathe(off, out, e.at);
    else crack(off, out, e.big, Math.max(0, e.at + (e.big ? 0 : 0.5)));
  }
  const d = (await off.startRendering()).getChannelData(0);
  const v = new DataView(new ArrayBuffer(44 + d.length * 2));
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + d.length * 2, true);
  w(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  return v.buffer;
}
