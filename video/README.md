# Demo video

How `revenant-demo.mp4` (2:41, 1920x1080) was made. Everything on screen is the live demo
install. The waits before the death and during the repair are sped up with the real elapsed
time in the corner; the death and the rise play at real speed with the app's own sound, which
is recorded from the page's Web Audio output.

1. `node login.cjs` signs the demo account in with its password (Secrets Manager
   `rv-revenant-demo`) and saves the session to `state.json` (gitignored, never committed).
2. `node rec.cjs <scene>` records one scene with Playwright into `clips/<scene>.webm` and its
   timing marks into `clips/<scene>.json`. Scenes: `intro install ask spec studio look code
   death tl admin outro`. A drawn cursor follows every move and shows a ring on each click.
   `death` removes the app's `RV_APP` variable and redeploys, so the deploy really fails and
   Revenant's rule repair puts it back.
3. Voice: Amazon Polly, generative engine, voice Matthew, from `lines.json` into `voice/`.
4. `python3 compose.py` cuts, captions and mixes everything into `out/revenant-demo.mp4`;
   the audio is then normalized to -16 LUFS.

`sheet.sh <clip>` makes a contact sheet to check a clip.
