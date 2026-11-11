// Record the live mockup in each theme: one webm per theme + key-moment screenshots.
// node record.cjs   (needs a Playwright install; path given by PW env or the default below)
const path = require("path");
const { chromium } = require(process.env.PW || "/home/ubuntu/workplace/redrob-auth/node_modules/playwright");
const exe = process.env.CHROME || "/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const out = process.env.OUT || path.join(process.env.HOME, ".kiro/crew/workspace/shots/revenant-live");
const page = "file://" + path.join(__dirname, "live.html");
const runs = [["normal", "off"], ["spooky", "off"], ["spooky", "on"]];

(async () => {
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  for (const [mode, calm] of runs) {
    const tag = mode === "normal" ? "light" : calm === "on" ? "haunted-calm" : "haunted";
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, recordVideo: { dir: out, size: { width: 1440, height: 860 } } });
    const p = await ctx.newPage();
    await p.goto(`${page}?mode=${mode}&calm=${calm}&once`);
    await p.waitForTimeout(600);
    // a short cursor sweep so the flashlight shows it follows the hand
    // the flashlight follows the mouse: tasks -> log -> preview -> heartbeat
    for (const [x, y] of [[180, 160], [200, 700], [700, 450], [900, 110]]) { await p.mouse.move(x, y, { steps: 18 }); await p.waitForTimeout(200); }
    await p.screenshot({ path: `${out}/${tag}-building.png` });
    await p.mouse.move(740, 520, { steps: 20 });
    await p.waitForFunction(() => window.__state === "dead"); await p.waitForTimeout(450);
    await p.screenshot({ path: `${out}/${tag}-dead.png` });
    await p.waitForTimeout(900); await p.mouse.move(190, 700, { steps: 25 });
    await p.waitForFunction(() => window.__state === "alive"); await p.mouse.move(520, 105, { steps: 20 }); await p.waitForTimeout(1800);
    await p.screenshot({ path: `${out}/${tag}-risen.png` });
    await p.waitForTimeout(1500);
    const v = await p.video().path();
    await ctx.close();
    require("fs").renameSync(v, `${out}/${tag}.webm`);
    console.log(tag, "ok");
  }
  await browser.close();
})();
