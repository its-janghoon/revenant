// Health check after a deploy (Requirement 5.6): the URL must answer 2xx (redirects followed).
export interface Health { ok: boolean; status: number | null; error?: string; tries: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tries until a 2xx or `waitS` seconds have passed. A new deploy can take a few seconds to serve. */
export async function health(url: string, waitS = 20): Promise<Health> {
  const until = Date.now() + waitS * 1000;
  let last: Health = { ok: false, status: null, tries: 0 };
  for (let tries = 1; ; tries++) {
    try {
      const r = await fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(8000), headers: { "user-agent": "revenant-health" } });
      last = { ok: r.status >= 200 && r.status < 300, status: r.status, tries };
    } catch (e) {
      last = { ok: false, status: null, error: (e as Error).name, tries };
    }
    if (last.ok || Date.now() + 2000 > until) return last;
    await sleep(Math.min(2000 * tries, 5000));
  }
}
