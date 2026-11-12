// Signs the demo account in with its password and saves the session to state.json.
const path = require("node:path");
const { open, demoPassword, SITE, DIR } = require("./lib.cjs");

(async () => {
  const { browser, ctx, page } = await open({ state: "/nonexistent" });
  const [email, pw] = demoPassword();
  await page.goto(SITE + "/signin");
  await page.getByRole("button", { name: /have a password/i }).click();
  await page.locator("#email").fill(email);
  await page.locator("#pw").fill(pw);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 30000 });
  await ctx.storageState({ path: path.join(DIR, "state.json") });
  console.log("signed in, at", new URL(page.url()).pathname);
  await browser.close();
})().catch((e) => { console.error("login failed:", e.message); process.exit(1); });
