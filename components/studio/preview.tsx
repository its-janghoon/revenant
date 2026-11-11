"use client";
// Preview tab (flow2.js S.studio): the preview build in a frame, Select mode with the element
// popover, and the tombstone when the deploy died. The preview build's inspect script
// (NEXT_PUBLIC_RV_INSPECT) answers "rv:inspect" with "rv:select" messages (app/_lib/types.ts).
import { ExternalLink, Loader, Lock, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { InspectIn, InspectOut } from "@/app/_lib/types";
import { Heartbeat, Tombstone, type Pulse } from "@/lib/haunt";
import { word, useTheme } from "@/lib/theme";

export interface PreviewProps {
  url: string | null;
  state: Pulse;
  deployNo: number;
  reason: string | null;
  phone: boolean;
  selectOn: boolean;
  selection: InspectOut | null;
  onSelect: (s: InspectOut | null) => void;
  onAsk: (text: string, s: InspectOut) => Promise<void>;
}

const QUICK: Record<"ai" | "style" | "text", string[]> = {
  ai: ["Make it full width on mobile", "Make it stand out more"],
  style: ["Color", "Size lg", "Radius 4"],
  text: ["Shorter text", "Friendlier text"],
};

export function Preview(p: PreviewProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const t = useTheme();
  const [kind, setKind] = useState<"ai" | "style" | "text">("ai");
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [key, setKey] = useState(0);
  const origin = p.url ? new URL(p.url).origin : null;

  const tell = (on: boolean) => {
    if (!origin) return;
    const msg: InspectIn = { type: "rv:inspect", on };
    frame.current?.contentWindow?.postMessage(msg, origin);
  };

  useEffect(() => { tell(p.selectOn); if (!p.selectOn) p.onSelect(null); }, [p.selectOn, origin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data as Partial<InspectOut> | null;
      if (m?.type !== "rv:select" || typeof m.file !== "string" || typeof m.line !== "number" || !m.rect) return;
      p.onSelect({ type: "rv:select", file: m.file, line: m.line, label: String(m.label ?? "Element"), text: m.text, rect: m.rect });
      setAsk("");
      setErr("");
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [origin, p]);

  async function submit() {
    if (!p.selection || !ask.trim()) return;
    setBusy(true); setErr("");
    try {
      const prefix = kind === "style" ? "Style change: " : kind === "text" ? "Text change: " : "";
      await p.onAsk(prefix + ask.trim(), p.selection);
      setAsk("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const s = p.selection;
  const popLeft = s ? Math.max(8, Math.min(s.rect.x, (frame.current?.clientWidth ?? 600) - 310)) : 0;
  const popTop = s ? s.rect.y + s.rect.h + 14 : 0;
  const mode = t.mode;

  return (
    <div className="stage">
      <div className={`frame${p.phone ? " phone" : ""}`}>
        <div className="url">
          <Lock size={11} aria-hidden />
          {p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.url.replace(/^https:\/\//, "")}</a> : <span>no preview yet</span>}
          <span className="sp" />
          {p.url ? (
            <>
              <button type="button" className="link" aria-label="Reload preview" onClick={() => setKey(key + 1)}><RotateCw size={11} aria-hidden /></button>
              <a href={p.url} target="_blank" rel="noreferrer" aria-label="Open in a new tab"><ExternalLink size={11} aria-hidden /></a>
            </>
          ) : null}
        </div>
        {p.url ? (
          <iframe key={key} ref={frame} src={p.url} title="App preview" onLoad={() => tell(p.selectOn)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads" />
        ) : (
          <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 30 }}>
            <div style={{ width: "100%", maxWidth: 520, textAlign: "center" }}>
              <Heartbeat state={p.state} />
              <div className="muted" style={{ marginTop: 10 }}>{p.state === "dead" ? "The build failed before a preview existed." : "The preview appears here after the first deploy."}</div>
            </div>
          </div>
        )}
        {p.state === "dead" && p.url ? (
          <div className="status-over" style={{ position: "absolute" }}>
            <div style={{ position: "relative", width: 320, height: 300 }}>
              <Tombstone title={word(mode, "tomb", { n: p.deployNo })} number={`#${p.deployNo}`} code={p.reason ?? undefined} />
            </div>
          </div>
        ) : null}
        {p.selectOn ? (
          <div className="over">
            {s ? (
              <>
                <div className="sel" style={{ left: s.rect.x, top: s.rect.y, width: s.rect.w, height: s.rect.h }}>
                  <span className="tag">{s.label} · {s.file.split("/").pop()}:{s.line}</span>
                </div>
                <form className="pop" style={{ left: popLeft, top: popTop }} onSubmit={(e) => { e.preventDefault(); void submit(); }}
                  onKeyDown={(e) => { if (e.key === "Escape") p.onSelect(null); }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }} role="tablist">
                    {([["ai", "Edit with AI"], ["style", "Style"], ["text", "Text"]] as const).map(([k, l]) => (
                      <button key={k} type="button" role="tab" aria-selected={kind === k} className={`pill${kind === k ? " on" : ""}`} onClick={() => setKind(k)}>
                        {k === "ai" ? <Sparkles size={11} aria-hidden /> : null}{l}
                      </button>
                    ))}
                  </div>
                  <input className="input" autoFocus value={ask} onChange={(e) => setAsk(e.target.value)}
                    placeholder={kind === "text" && s.text ? `“${s.text.slice(0, 40)}” →` : `${QUICK[kind][0]}…`} aria-label="What to change" />
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {QUICK[kind].map((q) => <button key={q} type="button" className="pill" onClick={() => setAsk(ask ? `${ask}, ${q.toLowerCase()}` : q)}>{q}</button>)}
                    <span className="sp" />
                    <button type="submit" className="btn" style={{ padding: "4px 10px", fontSize: 12 }} disabled={busy || !ask.trim()}>
                      {busy ? <Loader size={12} className="spin" aria-hidden /> : null}Send
                    </button>
                  </div>
                  {err ? <div className="err">{err}</div> : null}
                </form>
              </>
            ) : (
              <div className="sel" style={{ left: 12, top: 12, outline: "none" }}><span className="tag" style={{ top: 0 }}>Click an element in the preview</span></div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
