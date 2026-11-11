// Screenshot every screen in flow.html, in Light and Haunted, then make two contact sheets.
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require(process.env.PW || "/home/ubuntu/workplace/redrob-auth/node_modules/playwright");
const exe = process.env.CHROME || "/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const out = process.env.OUT || path.join(process.env.HOME, ".kiro/crew/workspace/shots/revenant-flow");
const page = "file://" + path.join(__dirname, "flow.html");
const order = ["signin", "welcome", "home", "spec", "build", "repair", "publish", "app", "cost", "admin", "policy", "users", "apps", "audit"];

(async () => {
  require("fs").mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  const p = await browser.newPage({ viewport: { width: 1440, height: 880 } });
  for (const mode of ["light", "haunted"]) {
    const files = [];
    for (const [i, s] of order.entries()) {
      await p.goto(`${page}?s=${s}&mode=${mode}`);
      await p.waitForTimeout(500);
      const f = `${out}/${mode}-${String(i + 1).padStart(2, "0")}-${s}.png`;
      await p.screenshot({ path: f });
      files.push(f);
    }
    execFileSync("montage", [...files, "-tile", "2x", "-geometry", "720x440+8+8", "-background", "#cfcfcc", `${out}/sheet-${mode}.png`]);
    console.log(mode, files.length);
  }
  await browser.close();
})();
