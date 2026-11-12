// Records one scene: node rec.cjs <scene>. Writes clips/<scene>.webm and clips/<scene>.json (marks in seconds).
const fs = require("node:fs");
const path = require("node:path");
const { open, glide, to, click, press, park, takeAudio, SITE, DIR } = require("./lib.cjs");

const P = "942a984f-767f-4646-b870-4b69a4e0dbb3";
const CARD = "file://" + path.join(DIR, "card.html");
const name = process.argv[2];
const wait = (page, s) => page.waitForTimeout(s * 1000);

const scenes = {
  async intro(page) { await page.goto(CARD); await park(page); await wait(page, 9); },

  async outro(page) {
    await page.goto(CARD + "?s=" + encodeURIComponent("github.com/its-janghoon/revenant<br>Open source, MIT. Built with Kiro.") + "&mono=1");
    await wait(page, 6);
  },

  async install(page, mark) {
    await page.goto("https://github.com/its-janghoon/revenant/tree/develop#install", { waitUntil: "domcontentloaded" });
    await wait(page, 2);
    const h = page.locator("article h2", { hasText: /^Install$/ }).first();
    await h.evaluate((e) => e.scrollIntoView({ block: "start" }));
    await page.mouse.wheel(0, -80);
    await park(page);
    mark("ready");
    await wait(page, 1);
    await to(page, page.getByRole("link", { name: /Launch the install stack/i }).first(), 1100);
    await wait(page, 1.2);
    await click(page, page.locator("article a", { hasText: "infra/install.yaml" }).first(), 900);
    await page.waitForURL(/install\.yaml/, { timeout: 20000 });
    await page.goto("https://github.com/its-janghoon/revenant/blob/develop/infra/install.yaml#L16-L30", { waitUntil: "domcontentloaded" });
    await wait(page, 2.5); await park(page);
    mark("template");
    await glide(page, 520, 330, 900); await wait(page, 1.2);
    await glide(page, 560, 420, 900); await wait(page, 1.2);
    await glide(page, 560, 500, 900); await wait(page, 3);
  },

  async ask(page, mark) {
    await page.goto(SITE + "/", { waitUntil: "networkidle" });
    await park(page); mark("ready");
    await wait(page, 0.8);
    const box = page.getByRole("textbox").first();
    await click(page, box, 900);
    await page.keyboard.type("Build me a contract signing site where an AI flags toxic clauses before you sign.", { delay: 28 });
    await to(page, page.getByRole("button", { name: /Write the spec/i }), 700);
    await wait(page, 1.5);
  },

  async spec(page, mark) {
    await page.goto(SITE + `/p/${P}/spec`, { waitUntil: "networkidle" });
    await wait(page, 1); await park(page); mark("ready");
    for (const [t, s] of [["Requirements", 2.6], ["Design", 2.6], ["Tasks", 2.6]]) {
      await click(page, page.getByRole("tab", { name: new RegExp("^" + t) }), 650);
      await wait(page, s);
    }
    await click(page, page.getByRole("tab", { name: /^Look/ }), 650);
    await wait(page, 1.2);
    await glide(page, 520, 520, 1200); await glide(page, 980, 520, 1300);
    await to(page, page.getByRole("button", { name: /Build it/i }), 900);
    await wait(page, 2);
  },

  async studio(page, mark) {
    await page.goto(SITE + `/p/${P}`, { waitUntil: "networkidle" });
    await wait(page, 3); await park(page); mark("ready");
    const frame = page.locator("iframe[title='App preview']");
    const fb = await frame.boundingBox();
    await glide(page, fb.x + fb.width * 0.5, fb.y + fb.height * 0.35, 1200);
    await wait(page, 3);
    await click(page, page.getByRole("button", { name: /^Select$/ }), 900);
    await wait(page, 1.2);
    const btn = page.frameLocator("iframe[title='App preview']").getByRole("link", { name: /Upload a contract/i }).first();
    const bb = await btn.boundingBox();
    await glide(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 1000);
    await wait(page, 0.4); await press(page);
    mark("selected");
    await wait(page, 5);
  },

  async look(page, mark) {
    await page.goto(SITE + `/p/${P}`, { waitUntil: "networkidle" });
    await wait(page, 2); await park(page);
    await click(page, page.getByRole("tab", { name: /^Design/ }), 800);
    await page.getByText(/DESIGN\.md · valid|DESIGN\.md · none/).first().waitFor({ timeout: 20000 }).catch(() => {});
    mark("ready");
    for (const n of ["Midnight", "Soft", "Studio", "Paper"]) {
      await click(page, page.getByRole("button", { name: new RegExp("^" + n + "$") }).first(), 600);
      await wait(page, 1.1);
    }
    await wait(page, 1);
  },

  // Code edit that breaks the build on purpose, then Haunted mode, the death and the repair.
  async code(page, mark) {
    await page.goto(SITE + `/p/${P}`, { waitUntil: "networkidle" });
    await wait(page, 2); await park(page);
    await click(page, page.getByRole("tab", { name: /^Code/ }), 800);
    await wait(page, 1.5); mark("ready");
    const tree = page.getByLabel("Files", { exact: true });
    for (const f of ["amplify", "functions", "review", "resource.ts"]) {
      const b = tree.locator("button", { hasText: new RegExp("^\\s*" + f.replace(".", "\\.") + "$") }).last();
      await b.waitFor({ timeout: 20000 });
      await click(page, b, 500); await wait(page, 0.5);
    }
    const ta = page.getByLabel("amplify/functions/review/resource.ts", { exact: true });
    await ta.waitFor({ timeout: 20000 });
    await wait(page, 1);
    // Put the caret right after "runtime: 2" and type 16 over 22.
    const pos = await ta.evaluate((e) => e.value.indexOf("runtime: 22") + "runtime: ".length);
    await to(page, ta, 700);
    await ta.evaluate((e, p) => { e.focus(); e.setSelectionRange(p, p + 2); }, pos);
    await wait(page, 0.5);
    await page.keyboard.type("16", { delay: 160 });
    mark("edited");
    await wait(page, 1);
    if (process.env.DRY) { await to(page, page.getByRole("button", { name: /^Commit/ }).last(), 700); await page.screenshot({ path: DIR + "/probe/dry.png" }); return; }
    await click(page, page.getByRole("button", { name: /^Commit/ }).last(), 700);
    const msg = page.getByLabel("Commit message");
    await msg.waitFor();
    await page.keyboard.type("Pin review to Node 16", { delay: 35 });
    await wait(page, 0.4);
    await click(page, page.locator("form button[type=submit]", { hasText: "Commit" }).first(), 500);
    mark("committed");
    await wait(page, 3);
    // Haunted, then watch the preview die and rise.
    await click(page, page.getByRole("button", { name: /^Haunted$/ }), 900);
    mark("haunted");
    await wait(page, 2);
    await click(page, page.getByRole("tab", { name: /^(Preview|The vessel)/ }).first(), 800);
    const t0 = Date.now();
    let died = false, rose = false;
    while (Date.now() - t0 < 40 * 60 * 1000) {
      const dead = await page.locator(".status-over").count();
      if (dead && !died) { died = true; mark("dead"); }
      if (died && !dead) { rose = true; mark("rose"); break; }
      // Sweep the flashlight a little so the cursor is alive.
      const k = ((Date.now() - t0) / 1000) % 20;
      await glide(page, 760 + 300 * Math.sin(k / 3), 420 + 160 * Math.cos(k / 4), 1500);
    }
    mark(rose ? "done" : "timeout");
    await wait(page, 6);
    await click(page, page.getByRole("tab", { name: /^(Timeline|The chronicle)/ }).first(), 900);
    mark("timeline");
    await wait(page, 8);
  },

  // A deploy-time break (the app's RV_APP env var removed), so the preview really dies on camera.
  async death(page, mark) {
    const { execFileSync } = require("node:child_process");
    const aws = (...a) => execFileSync("aws", a, { env: { ...process.env, AWS_PROFILE: "revenant", AWS_REGION: "us-east-1" } }).toString();
    const APP = "d307shabewefz0", BR = "preview/4";
    await page.goto(SITE + `/p/${P}`, { waitUntil: "networkidle" });
    await wait(page, 2); await park(page);
    await click(page, page.getByRole("button", { name: /^Haunted$/ }), 900);
    await wait(page, 1);
    await click(page, page.getByRole("button", { name: /^Sound$/ }), 700);
    await wait(page, 1);
    await glide(page, 760, 470, 900);
    await wait(page, 2); mark("ready");
    for (const [scope, get, set] of [["app", ["get-app", "--app-id", APP, "--query", "app.environmentVariables"], ["update-app", "--app-id", APP]],
      ["branch", ["get-branch", "--app-id", APP, "--branch-name", BR, "--query", "branch.environmentVariables"], ["update-branch", "--app-id", APP, "--branch-name", BR]]]) {
      const env = JSON.parse(aws("amplify", ...get, "--output", "json"));
      delete env.RV_APP;
      aws("amplify", ...set, "--environment-variables", JSON.stringify(env), "--query", "length(@)");
      console.log("removed RV_APP from", scope);
    }
    aws("amplify", "start-job", "--app-id", APP, "--branch-name", BR, "--job-type", "RELEASE", "--query", "jobSummary.jobId", "--output", "text");
    mark("planted");
    const t0 = Date.now();
    let died = false, rose = false;
    while (Date.now() - t0 < 25 * 60 * 1000) {
      const dead = await page.locator(".status-over").count();
      if (dead && !died) { died = true; mark("dead"); }
      if (died && !dead) { rose = true; mark("rose"); break; }
      await wait(page, 0.5); // the cursor stays still: this part is sped up later
    }
    mark(rose ? "done" : "timeout");
    await wait(page, 6);
    await click(page, page.getByRole("tab", { name: /^(Timeline|The chronicle)/ }).first(), 900);
    mark("timeline");
    await wait(page, 10);
  },

  async tl(page, mark) {
    await page.goto(SITE + `/p/${P}`, { waitUntil: "networkidle" });
    await wait(page, 1.5); await park(page);
    await click(page, page.getByRole("button", { name: /^Haunted$/ }), 700);
    await wait(page, 0.8);
    await click(page, page.getByRole("button", { name: /^Sound$/ }), 700);
    await wait(page, 1.2);
    await click(page, page.getByRole("tab", { name: /^(Timeline|The chronicle)/ }).first(), 800);
    await wait(page, 1.5); mark("ready");
    await glide(page, 560, 290, 1200); await wait(page, 3);
    await glide(page, 1000, 290, 1200); await wait(page, 2);
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 90); await wait(page, 0.35); }
    await glide(page, 760, 520, 1200); await wait(page, 4);
  },

  async admin(page, mark) {
    await page.goto(SITE + "/admin/policy", { waitUntil: "networkidle" });
    await wait(page, 1); await park(page); mark("ready");
    await glide(page, 520, 260, 900); await wait(page, 1.2);
    await glide(page, 1000, 300, 900); await wait(page, 1.2);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 110); await wait(page, 0.25); }
    await glide(page, 560, 520, 900); await wait(page, 2.2);
    await click(page, page.getByRole("link", { name: /^Audit log$/ }), 900);
    await page.waitForLoadState("networkidle"); await park(page);
    mark("audit");
    await wait(page, 4);
  },
};

(async () => {
  if (!scenes[name]) throw new Error("scene? " + Object.keys(scenes).join(" "));
  const tmp = path.join(DIR, "clips", name + ".tmp");
  fs.rmSync(tmp, { recursive: true, force: true });
  const { browser, ctx, page } = await open({ video: tmp });
  const start = Date.now(), marks = {};
  const mark = (k) => { marks[k] = (Date.now() - start) / 1000; console.log("mark", k, marks[k].toFixed(1)); };
  try { await scenes[name](page, mark); } finally {
    mark("end");
    const audio = await takeAudio(page);
    audio.forEach((a, k) => fs.writeFileSync(path.join(DIR, "clips", `${name}.audio${k}.webm`), Buffer.from(a.b64, "base64")));
    marks.audio = audio.map((a) => (a.t0 - start) / 1000);
    const v = page.video();
    await ctx.close(); await browser.close();
    if (v) fs.renameSync(await v.path(), path.join(DIR, "clips", name + ".webm"));
    fs.writeFileSync(path.join(DIR, "clips", name + ".json"), JSON.stringify(marks, null, 1));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error("scene failed:", e.message.split("\n")[0]); process.exit(1); });
