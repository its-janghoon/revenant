// The few Lucide icons the admin screens use (lucide.dev, ISC license), inlined so the app
// needs no icon dependency. Same 24x24 stroke geometry as lucide-react 0.522.
import { createElement, type ReactNode } from "react";

type Node = [string, Record<string, string>];
const p = (d: string): Node => ["path", { d }];
const c = (cx: string, cy: string, r: string): Node => ["circle", { cx, cy, r }];
const l = (x1: string, y1: string, x2: string, y2: string): Node => ["line", { x1, y1, x2, y2 }];

const ICONS = {
  "layout-dashboard": [
    ["rect", { width: "7", height: "9", x: "3", y: "3", rx: "1" }], ["rect", { width: "7", height: "5", x: "14", y: "3", rx: "1" }],
    ["rect", { width: "7", height: "9", x: "14", y: "12", rx: "1" }], ["rect", { width: "7", height: "5", x: "3", y: "16", rx: "1" }],
  ],
  users: [p("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), p("M16 3.128a4 4 0 0 1 0 7.744"), p("M22 21v-2a4 4 0 0 0-3-3.87"), c("9", "7", "4")],
  boxes: [
    p("M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"), p("m7 16.5-4.74-2.85"), p("m7 16.5 5-3"), p("M7 16.5v5.17"),
    p("M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"), p("m17 16.5-5-3"), p("m17 16.5 4.74-2.85"), p("M17 16.5v5.17"),
    p("M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"), p("M12 8 7.26 5.15"), p("m12 8 4.74-2.85"), p("M12 13.5V8"),
  ],
  box: [p("M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"), p("m3.3 7 8.7 5 8.7-5"), p("M12 22V12")],
  "shield-check": [p("M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"), p("m9 12 2 2 4-4")],
  brain: [
    p("M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"), p("M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"),
    p("M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"), p("M17.599 6.5a3 3 0 0 0 .399-1.375"), p("M6.003 5.125A3 3 0 0 0 6.401 6.5"), p("M3.477 10.896a4 4 0 0 1 .585-.396"),
    p("M19.938 10.5a4 4 0 0 1 .585.396"), p("M6 18a4 4 0 0 1-1.967-.516"), p("M19.967 17.484A4 4 0 0 1 18 18"),
  ],
  wallet: [p("M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"), p("M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4")],
  "scroll-text": [p("M15 12h-5"), p("M15 8h-5"), p("M19 17V5a2 2 0 0 0-2-2H4"), p("M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3")],
  "dollar-sign": [l("12", "2", "12", "22"), p("M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6")],
  "heart-pulse": [p("M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"), p("M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27")],
  "alert-triangle": [p("m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"), p("M12 9v4"), p("M12 17h.01")],
  "user-plus": [p("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), c("9", "7", "4"), l("19", "8", "19", "14"), l("22", "11", "16", "11")],
  skull: [p("m12.5 17-.5-1-.5 1h1z"), p("M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"), c("15", "12", "1"), c("9", "12", "1")],
  database: [["ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }], p("M3 5V19A9 3 0 0 0 21 19V5"), p("M3 12A9 3 0 0 0 21 12")],
  timer: [l("10", "2", "14", "2"), l("12", "14", "15", "11"), c("12", "14", "8")],
  search: [p("m21 21-4.34-4.34"), c("11", "11", "8")],
  "more-horizontal": [c("12", "12", "1"), c("19", "12", "1"), c("5", "12", "1")],
  "external-link": [p("M15 3h6v6"), p("M10 14 21 3"), p("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6")],
  "trash-2": [p("M3 6h18"), p("M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"), p("M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"), l("10", "11", "10", "17"), l("14", "11", "14", "17")],
  x: [p("M18 6 6 18"), p("m6 6 12 12")],
} satisfies Record<string, Node[]>;

export type IconName = keyof typeof ICONS;

export function Icon({ n, s = 16 }: { n: IconName; s?: number }): ReactNode {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ic-svg">
      {(ICONS[n] as Node[]).map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
