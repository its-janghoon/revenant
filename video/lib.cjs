// Shared helpers for the demo recording: browser, sign-in, a visible cursor, smooth moves.
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");

const DIR = __dirname;
const SITE = "https://revenant.janghoonlee.com";
const W = 1440, H = 810; // recorded at this size, scaled to 1920x1080 when composed
const CHROME = process.env.CHROME || undefined; // a local Chromium, else Playwright's own

function demoPassword() {
  const s = execFileSync("aws", ["secretsmanager", "get-secret-value", "--region", "us-east-1", "--secret-id", "rv-revenant-demo", "--query", "SecretString", "--output", "text"], { env: { ...process.env, AWS_PROFILE: "revenant" } }).toString();
  const o = JSON.parse(s);
  return [Object.keys(o)[0], Object.values(o)[0]];
}

// A drawn arrow cursor that follows real mouse events, plus a ring on click.
const CURSOR = `
(() => {
  if (window.__rvCursor || window.top !== window) return; window.__rvCursor = 1;
  const add = () => {
    const c = document.createElement('div');
    c.id = '__rvc';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.8 L11.6 14 L18 14 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-100px,-100px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' });
    document.documentElement.appendChild(c);
    const x = Number(sessionStorage.getItem('__rvx') || 720), y = Number(sessionStorage.getItem('__rvy') || 405);
    c.style.transform = 'translate(' + (x - 4) + 'px,' + (y - 2) + 'px)';
    window.__rvMove = (x, y) => { c.style.transform = 'translate(' + (x - 4) + 'px,' + (y - 2) + 'px)'; sessionStorage.setItem('__rvx', x); sessionStorage.setItem('__rvy', y); };
    window.__rvRing = (x, y) => {
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: (x - 18) + 'px', top: (y - 18) + 'px', width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #3b82f6', zIndex: 2147483646, pointerEvents: 'none', transition: 'all .45s ease-out', opacity: '1' });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    };
  };
  if (document.documentElement) add(); else addEventListener('DOMContentLoaded', add);
})();`;

// Records whatever the page plays through Web Audio (the app's rain and thunder) next to the video.
const AUDIO = `
(() => {
  if (window.top !== window || window.__rvAudioHook) return; window.__rvAudioHook = 1;
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const out = orig.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode) {
      const ac = dest.context;
      if (!ac.__rv) {
        const md = ac.createMediaStreamDestination();
        const rec = new MediaRecorder(md.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 });
        const chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.start(1000);
        ac.__rv = { md, rec, chunks, t0: Date.now() };
        (window.__rvAudio = window.__rvAudio || []).push(ac.__rv);
      }
      try { orig.call(this, ac.__rv.md); } catch {}
    }
    return out;
  };
})();`;

// Stops the page's audio recorders; returns [{ t0, b64 }] (t0 = epoch ms the recording began).
async function takeAudio(page) {
  return page.evaluate(async () => {
    const out = [];
    for (const r of window.__rvAudio || []) {
      await new Promise((ok) => { r.rec.onstop = ok; r.rec.stop(); });
      const buf = new Uint8Array(await new Blob(r.chunks, { type: 'audio/webm' }).arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
      out.push({ t0: r.t0, b64: btoa(s) });
    }
    return out;
  }).catch(() => []);
}

async function open({ video, state = path.join(DIR, "state.json") } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [`--window-size=${W},${H}`, "--force-device-scale-factor=1", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1,
    ...(require("node:fs").existsSync(state) ? { storageState: state } : {}),
    ...(video ? { recordVideo: { dir: video, size: { width: W, height: H } } } : {}),
  });
  await ctx.addInitScript(CURSOR);
  await ctx.addInitScript(AUDIO);
  const page = await ctx.newPage();
  page.__x = W / 2; page.__y = H / 2;
  return { browser, ctx, page };
}

// Eased move from the last point, so the cursor glides like a hand.
async function glide(page, x, y, ms = 700) {
  const x0 = page.__x, y0 = page.__y, n = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) {
    const t = i / n, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const px = x0 + (x - x0) * e, py = y0 + (y - y0) * e;
    await page.mouse.move(px, py);
    await page.evaluate(([a, b]) => window.__rvMove && window.__rvMove(a, b), [px, py]).catch(() => {});
    await page.waitForTimeout(Math.max(0, ms / n - 4));
  }
  page.__x = x; page.__y = y;
}

async function center(loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box for " + loc);
  return [b.x + b.width / 2, b.y + b.height / 2];
}

async function to(page, loc, ms) { const [x, y] = await center(loc); await glide(page, x, y, ms); }
async function press(page) { await page.evaluate(([a, b]) => window.__rvRing && window.__rvRing(a, b), [page.__x, page.__y]).catch(() => {}); await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up(); }
async function click(page, loc, ms = 700) { await to(page, loc, ms); await page.waitForTimeout(150); await press(page); }
// Puts the cursor back after a navigation (the new page draws it at the saved spot).
async function park(page) { await page.evaluate(([a, b]) => window.__rvMove && window.__rvMove(a, b), [page.__x, page.__y]).catch(() => {}); }

module.exports = { takeAudio, open, glide, to, click, press, park, center, demoPassword, SITE, DIR, W, H };
