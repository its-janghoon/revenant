// Built-in looks: each is a DESIGN.md in Google's format (github.com/google-labs-code/design.md).
// Written for Revenant, not copied from any brand. The id is stored nowhere: a project's look is
// the DESIGN.md in its repo, and lib/looks/index.ts recognises a preset by its `name`.

export interface Preset { id: string; name: string; blurb: string; markdown: string }

const doc = (front: string, body: string) => `---\n${front.trim()}\n---\n\n${body.trim()}\n`;

export const PRESETS: Preset[] = [
  {
    id: "plain",
    name: "Plain",
    blurb: "Neutral, no extra style",
    markdown: doc(`
version: alpha
name: Plain
description: Neutral and quiet. The content carries the page.
colors:
  primary: "#141414"
  on-primary: "#ffffff"
  surface: "#ffffff"
  background: "#fbfbfa"
  ink: "#141414"
  muted: "#6c6c68"
  line: "#e7e6e2"
  success: "#127a45"
  warning: "#9a6400"
  danger: "#c0341d"
typography:
  h1: { fontFamily: Inter, fontSize: 32px, fontWeight: 650, lineHeight: 1.15, letterSpacing: -0.02em }
  h2: { fontFamily: Inter, fontSize: 22px, fontWeight: 600, lineHeight: 1.25 }
  body: { fontFamily: Inter, fontSize: 15px, fontWeight: 400, lineHeight: 1.55 }
  label: { fontFamily: Inter, fontSize: 12px, fontWeight: 600, letterSpacing: 0.04em }
rounded: { sm: 4px, md: 8px, lg: 12px, full: 9999px }
spacing: { xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 40px }
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.md}" }
  card: { backgroundColor: "{colors.surface}", rounded: "{rounded.lg}" }
`, `
## Overview
Plain is the default look: black text on off-white, one dark accent, thin borders. Use it when
the app should look like a tool, not a brand.

## Colors
One accent (\`primary\`) for the main action on each screen. \`success\`, \`warning\` and \`danger\`
only for status, always with a text label, never color alone.

## Layout
Content column up to 1120px. Cards with a 1px \`line\` border and no shadow. Generous space
between sections (\`spacing.xl\`).

## Do and don't
- Do keep one primary button per screen.
- Don't add gradients, shadows or decorative images.
`),
  },
  {
    id: "paper",
    name: "Paper",
    blurb: "Editorial serif, ink blue",
    markdown: doc(`
version: alpha
name: Paper
description: Calm and trustworthy, like a well set printed page.
colors:
  primary: "#1f3a6e"
  on-primary: "#ffffff"
  surface: "#fffdf8"
  background: "#f8f5ee"
  ink: "#1b1a17"
  muted: "#6b665c"
  line: "#e3ddcf"
  success: "#2f6b3f"
  warning: "#8a5a00"
  danger: "#a32a1d"
typography:
  h1: { fontFamily: Georgia, fontSize: 40px, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.01em }
  h2: { fontFamily: Georgia, fontSize: 26px, fontWeight: 700, lineHeight: 1.2 }
  body: { fontFamily: Inter, fontSize: 16px, fontWeight: 400, lineHeight: 1.6 }
  label: { fontFamily: Inter, fontSize: 12px, fontWeight: 600, letterSpacing: 0.06em }
rounded: { sm: 2px, md: 4px, lg: 8px, full: 9999px }
spacing: { xs: 4px, sm: 8px, md: 16px, lg: 28px, xl: 48px }
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.md}" }
  card: { backgroundColor: "{colors.surface}", rounded: "{rounded.lg}" }
`, `
## Overview
Paper feels like a printed document: warm paper background, near-black ink, a serif for
headings and one deep ink-blue accent. Good for legal, finance and anything people read
closely.

## Colors
Ink-blue \`primary\` for the main action and links. Status colors are muted, shown as soft tinted
badges with a text label.

## Typography
Headings in Georgia, body in Inter at 16px with a 1.6 line height. Keep lines under 72
characters.

## Do and don't
- Do use rules (1px \`line\`) to separate sections instead of boxes everywhere.
- Don't use bright or saturated colors besides the status badges.
`),
  },
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Dark, one teal accent",
    markdown: doc(`
version: alpha
name: Midnight
description: A dark, focused interface with a single teal accent.
colors:
  primary: "#2dd4bf"
  on-primary: "#04211d"
  surface: "#151b23"
  background: "#0d1117"
  ink: "#e6edf3"
  muted: "#8b949e"
  line: "#262f3a"
  success: "#3fb950"
  warning: "#d29922"
  danger: "#f85149"
typography:
  h1: { fontFamily: Inter, fontSize: 34px, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.02em }
  h2: { fontFamily: Inter, fontSize: 22px, fontWeight: 650, lineHeight: 1.25 }
  body: { fontFamily: Inter, fontSize: 15px, fontWeight: 400, lineHeight: 1.55 }
  mono: { fontFamily: JetBrains Mono, fontSize: 13px, fontWeight: 500 }
rounded: { sm: 6px, md: 8px, lg: 12px, full: 9999px }
spacing: { xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 40px }
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.md}" }
  card: { backgroundColor: "{colors.surface}", rounded: "{rounded.lg}" }
`, `
## Overview
Midnight is a dark interface for tools people keep open all day: near-black background,
slightly lighter cards, light gray text and one teal accent.

## Colors
Teal \`primary\` only for the main action, focus rings and the active nav item. Everything else
stays gray. Check contrast: body text is \`ink\` on \`background\`, never \`muted\` for long text.

## Do and don't
- Do use \`mono\` for ids, hashes and numbers that line up.
- Don't use pure white or pure black.
`),
  },
  {
    id: "studio",
    name: "Studio",
    blurb: "Bold type, square edges",
    markdown: doc(`
version: alpha
name: Studio
description: Confident and graphic. Big type, square edges, one strong blue.
colors:
  primary: "#1d4ed8"
  on-primary: "#ffffff"
  surface: "#ffffff"
  background: "#ffffff"
  ink: "#0b0b0b"
  muted: "#5c5c5c"
  line: "#e5e5e5"
  success: "#15803d"
  warning: "#a16207"
  danger: "#b91c1c"
typography:
  h1: { fontFamily: Helvetica Neue, fontSize: 52px, fontWeight: 800, lineHeight: 1.0, letterSpacing: -0.03em }
  h2: { fontFamily: Helvetica Neue, fontSize: 28px, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.02em }
  body: { fontFamily: Helvetica Neue, fontSize: 16px, fontWeight: 400, lineHeight: 1.5 }
  label: { fontFamily: Helvetica Neue, fontSize: 12px, fontWeight: 700, letterSpacing: 0.08em }
rounded: { sm: 0px, md: 0px, lg: 0px, full: 9999px }
spacing: { xs: 4px, sm: 8px, md: 16px, lg: 32px, xl: 64px }
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.md}" }
  card: { backgroundColor: "{colors.surface}", rounded: "{rounded.lg}" }
`, `
## Overview
Studio is graphic and direct: very large headings, square corners, thick black rules and one
strong blue. Good for products that want to feel bold.

## Layout
Use a strict grid. Separate sections with a 2px \`ink\` rule. Large empty space around the hero.

## Do and don't
- Do set headings tight (negative letter spacing).
- Don't round corners or add shadows.
`),
  },
  {
    id: "soft",
    name: "Soft",
    blurb: "Rounded, calm green",
    markdown: doc(`
version: alpha
name: Soft
description: Friendly and calm. Rounded shapes and a gentle green.
colors:
  primary: "#2f7d5b"
  on-primary: "#ffffff"
  surface: "#ffffff"
  background: "#f3f8f4"
  ink: "#1f2d27"
  muted: "#5f6f67"
  line: "#d8e6dc"
  success: "#2f7d5b"
  warning: "#946200"
  danger: "#b3402f"
typography:
  h1: { fontFamily: Inter, fontSize: 34px, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.01em }
  h2: { fontFamily: Inter, fontSize: 22px, fontWeight: 600, lineHeight: 1.25 }
  body: { fontFamily: Inter, fontSize: 16px, fontWeight: 400, lineHeight: 1.6 }
  label: { fontFamily: Inter, fontSize: 13px, fontWeight: 600 }
rounded: { sm: 10px, md: 14px, lg: 20px, full: 9999px }
spacing: { xs: 4px, sm: 10px, md: 18px, lg: 28px, xl: 44px }
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.full}" }
  card: { backgroundColor: "{colors.surface}", rounded: "{rounded.lg}" }
`, `
## Overview
Soft is friendly: a pale green background, white rounded cards, pill buttons and a calm
green accent. Good for consumer apps and onboarding-heavy flows.

## Do and don't
- Do use pill-shaped buttons and inputs.
- Do keep shadows very soft (or none).
- Don't use sharp corners or dense tables.
`),
  },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? null;
