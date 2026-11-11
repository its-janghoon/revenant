# Demo video storyboard

**DRAFT, awaiting Janghoon's approval.** Nothing is recorded or rendered until this is
approved (Requirement 15.5).

## Open questions for Janghoon

- Keep the video silent apart from app sound, or add his own voice-over?
- Scene 2: show a seat-price mock at all, or only the AWS console?

## Format

- Length: 2:42 (limit 3:00; keep the cut under 2:55). Differences from Lovable end by 0:18,
  the install is complete on screen by 0:30 (Requirement 15.1, 15.4).
- Source: Playwright recordings of the real app on the demo install, composed in Remotion.
  Install and builds take minutes in real life; those shots are sped up and always show the
  real elapsed time in a corner clock, so no step looks faster than it is.
- Sound: only what the app makes itself (rain, thunder, the close crack, the breath),
  captured from the browser tab with Sound on. UI clicks are the app's own. No music, no
  stock audio, no voice-over. Silence is used on purpose.
- Captions: burned in, white on a dark bar in Light scenes, bone `#e9e2d2` in Haunted.
  One line at a time, at most about 10 words.
- Trademarks: other products are named in caption text only, never with their logos.
  AWS service names appear as they do in the AWS console.
- Logo: Pulse, a flat line that beats once, on a rounded square.

## Scenes

| # | Time | On screen | Camera / motion | Caption | Sound |
|---|---|---|---|---|---|
| 1 | 0:00-0:03 | Black. The Pulse line is flat, then beats once and the Revenant wordmark appears | Static; the beat draws left to right | "Revenant" | Silence, then one soft thunder roll far away |
| 2 | 0:03-0:07 | Split screen. Left: a generic hosted builder with a seat-count pricing table (mock, no brand). Right: the AWS console sign-in to the user's own account | Slow push-in on the right half | "Lovable-style building. In your AWS account." | Rain starts, quiet |
| 3 | 0:07-0:10 | Revenant home: "AWS credits left" and "This month" figures | Zoom to the credits tile | "No seats. Your AWS bill and credits." | Rain |
| 4 | 0:10-0:13 | FinePrint spec screen: requirements, design, tasks tabs | Pan across the three tabs | "Spec first. You edit the plan, not prompts." | Rain |
| 5 | 0:13-0:18 | Timeline row: a deploy died, then rose, with cause and time to recover | Hold, the heartbeat goes flat then beats | "When a deploy dies, it fixes itself." | One thunder crack on the flat line |
| 6 | 0:18-0:21 | README Install section, click "Launch stack" (quick-create) | Cursor-led zoom on the button | "Install: one step." | Rain fades to room silence |
| 7 | 0:21-0:30 | Quick-create page with three fields: Kiro API key (masked), `admin@example.com`, budget 100. Create stack | Fields fill, then sped up through CREATE_IN_PROGRESS to CREATE_COMPLETE; corner clock shows real time | "Three fields. No GitHub token. No mail domain." | Silence |
| 8 | 0:30-0:37 | Stack Outputs with the Revenant URL; inbox with the Cognito invite; sign-in by email code | Quick cuts, each 2-3 s | "Sign in with an email code. No password." | Silence |
| 9 | 0:37-0:41 | Onboarding: pick Light, start from the FinePrint example; background ticks for account, Kiro, budget | Hold on the ticks turning green | "One screen. Account checks run behind it." | Silence |
| 10 | 0:41-0:48 | Home prompt box; the request is typed: "Build me a contract signing site where an AI flags toxic clauses before you sign." | Close on the prompt, then send | (the request itself is the caption) | Keys |
| 11 | 0:48-0:59 | Spec screen for FinePrint: plain summaries on top, raw markdown below, AWS parts and estimated monthly cost. Press "Build it" | Scroll the requirements, stop on the cost line, then the button | "Kiro writes the spec. Nothing builds until you say so." | Silence |
| 12 | 0:59-1:12 | Studio: chat on the left with plan and file-diff cards, task list ticking; Preview on the right appears | Sped up with the corner clock; push-in on the first preview frame | "Kiro CLI builds it in CodeBuild, in your account." | Silence |
| 13 | 1:12-1:17 | FinePrint preview: a sample contract with two clauses flagged red | Slow zoom on a flagged clause | "A preview per change, with its own data." | Silence |
| 14 | 1:17-1:32 | **Select edit**: turn on Select, click the "Sign" button; the panel shows `app/sign/page.tsx:42`, change the color, then "Edit with AI": "make the warning bigger" | Cursor-led, zoom to the source line badge | "Click anything. See its file and line. Edit it." | Clicks |
| 15 | 1:32-1:45 | **Code edit**: Code tab, open the clause list file, change one label, Commit to the preview branch; the next preview rebuilds; the `git clone` command is visible | Zoom on the commit button, then the new preview | "Or edit the code. The agent starts from your commit." | Keys |
| 16 | 1:45-1:50 | Header switch from Light to **Haunted**, Sound on. The screen goes dark, FinePrint is now "Blood Oath", the flashlight follows the cursor | Hold while the flashlight sweeps | "Haunted mode." | Rain and distant thunder, from the app |
| 17 | 1:50-2:01 | Publish. The production deploy **dies** on a planted break: rain cuts out, then the strike (white, black, white), the quake, the tombstone over the preview, blood from the top | No camera move; the app's own shake does the work | "It died." | 1 s silence, then the close crack; a quiet breath when the failure line appears |
| 18 | 2:01-2:21 | **Real repair**: timeline shows the ritual: the failing log, the cause in one sentence, the fix on `revenant/fix-1` with its diff, check passed, merged, redeployed. The heartbeat comes back and the tombstone lifts | Sped up with the corner clock; push-in on "Time to recover" | "Kiro read the logs and fixed it. Time to recover: <measured>." | Rain returns; the bloom when it rises |
| 19 | 2:21-2:26 | The live Blood Oath site at its production URL | Hold | "It has risen. Live on your AWS." | Rain |
| 20 | 2:26-2:37 | Switch back to Light. **Admin policy** `/admin/policy`: SQL off for the install, on for one user; Kiro payer: company key, bring your own Kiro, or both; model Auto; budget; auto-delete. The audit log row appears | Pan down the policy page, end on the audit row | "One policy for everyone. Every change audited." | Silence |
| 21 | 2:37-2:42 | Pulse logo, "Revenant", repo URL, "Open source, MIT. Built with Kiro." | Static; the line beats once | (on-screen text only) | One far thunder roll, fade out |

## Notes for recording

- The planted break in scene 17 is one of the three from task 2.3; the shot uses whichever
  repairs most clearly on camera. The time to recover in scene 18 is the real value from
  that run's timeline, not a typed number.
- Scenes 7 and 8 are recorded on a fresh dedicated AWS account. Account ids are blurred;
  any visible id is replaced with `111122223333`. Only `example.com` addresses appear.
- Scene 2's left half is a plain mock built for the video, with no real product's name,
  logo or prices.
- Scenes 16-19 run in Haunted Full; record once more in Calm to check nothing in the
  story depends on the effects.
