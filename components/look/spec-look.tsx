"use client";
// Look tab of the spec screen (design/mockups/look.html option B): pick or edit the app's DESIGN.md
// before Build it. The build follows DESIGN.md by itself, so this only saves the file (no apply).
import { Check, Loader, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DesignCheck, Look, ProjectLook } from "@/lib/contracts";
import { api } from "../api";
import { CheckLine, Mini, readDrop, useLooks } from "./mini";

export type SpecLook = ReturnType<typeof useSpecLook>;

/** State shared by the Look tab and the "Build with" side card. */
export function useSpecLook(id: string) {
  const { looks, error: looksError } = useLooks();
  const [pl, setPl] = useState<ProjectLook | null>(null);
  const [sel, setSel] = useState<string | null>(null); // preset id, "company", "own"
  const [md, setMd] = useState("");
  const [savedMd, setSavedMd] = useState("");
  const [check, setCheck] = useState<DesignCheck | null>(null);
  const [typed, setTyped] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    api<ProjectLook>(`/api/projects/${id}/look`, { signal: ac.signal }).then((p) => {
      setPl(p);
      setCheck(p.check);
      if (p.markdown) { setMd(p.markdown); setSavedMd(p.markdown); setSel(p.locked ? "company" : p.look ?? "own"); }
      else if (p.locked) setSel("company");
    }, (e: Error) => { if (!ac.signal.aborted) setErr(e.message); });
    return () => ac.abort();
  }, [id]);

  // Locked with no DESIGN.md yet: show the company file read-only.
  useEffect(() => {
    if (pl?.locked && !pl.markdown && looks?.company) { setMd(looks.company.markdown); setCheck(looks.company.check); }
  }, [pl, looks]);

  // Lint while typing (dry PUT, nothing saved), ~500 ms after the last key.
  useEffect(() => {
    if (!typed || !md.trim()) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      api<{ check: DesignCheck }>(`/api/projects/${id}/look`, { method: "PUT", body: { markdown: md, dry: true }, signal: ac.signal })
        .then((r) => setCheck(r.check), () => {});
    }, 500);
    return () => { clearTimeout(t); ac.abort(); };
  }, [typed, md, id]);

  const locked = Boolean(pl?.locked);
  const cards: Look[] = locked
    ? (looks?.company ? [looks.company] : [])
    : [...(looks?.company ? [looks.company] : []), ...(looks?.presets ?? [])];
  const name = sel === "own" ? "Your own" : cards.find((l) => l.id === sel)?.name ?? (sel === "company" ? "Company" : null);

  async function save(markdown = md) {
    if (locked || !markdown.trim()) return;
    setErr(""); setSaving(true);
    try {
      const r = await api<{ check: DesignCheck }>(`/api/projects/${id}/look`, { method: "PUT", body: { markdown } });
      setCheck(r.check);
      setSavedMd(markdown);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /** One click picks: load the look into the editor and save it. */
  function choose(l: Look) {
    if (locked) return;
    setSel(l.id); setMd(l.markdown); setCheck(l.check);
    void save(l.markdown);
  }

  function own(text: string | null) {
    if (locked) return;
    setSel("own");
    if (text?.trim()) { setMd(text); void save(text); }
  }

  const edit = (v: string) => { setMd(v); setTyped((n) => n + 1); };

  return { looks, looksError, pl, sel, md, savedMd, check, saving, err, locked, cards, name, save, choose, own, edit };
}

/** The tab body: look cards, then the DESIGN.md editor. */
export function LookTab({ s, app }: { s: SpecLook; app: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  if (!s.looks || !s.pl) {
    return <div className="card">{s.looksError || s.err ? <div className="err" role="alert">{s.looksError ?? s.err}</div> : <div className="muted"><Loader size={13} className="spin" aria-hidden /> Loading looks…</div>}</div>;
  }
  const mark = <Check size={14} aria-label="picked" />;
  const co = s.looks.company;
  return (
    <div>
      {s.locked ? <div className="muted" style={{ marginBottom: 10 }}>Your admin requires the company design</div> : null}
      <div className="looks">
        {s.cards.map((l) => (
          <button key={l.id} type="button" className={`look${s.sel === l.id ? " on" : ""}`} aria-pressed={s.sel === l.id} onClick={() => s.choose(l)} disabled={s.locked || s.saving}>
            <Mini check={l.check} app={app} />
            <span className="tx">
              <b>{l.name}{l === co ? <span className={`chip ${co.mode === "required" ? "c-warn" : "c-ok"}`}>{co.mode}</span> : null}{s.sel === l.id ? mark : null}</b>
              <span>{l.blurb}</span>
            </span>
          </button>
        ))}
        {s.locked ? null : (
          <button type="button" className={`look${s.sel === "own" ? " on" : ""}`} aria-pressed={s.sel === "own"} disabled={s.saving}
            onClick={() => { s.own(null); file.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void readDrop(e.dataTransfer.files).then(s.own); }}>
            <span className={`lookown${over ? " on" : ""}`}>Drop DESIGN.md<br />or click to pick</span>
            <span className="tx"><b>Your own{s.sel === "own" ? mark : null}</b><span>Google DESIGN.md format, or paste it below</span></span>
          </button>
        )}
      </div>
      <input ref={file} type="file" accept=".md,text/markdown" hidden onChange={(e) => { void readDrop(e.target.files).then(s.own); e.target.value = ""; }} />
      <div className="row-f" style={{ margin: "16px 0 8px" }}>
        <span className="label" style={{ margin: 0 }}>DESIGN.md · {s.name ?? "none yet"}{s.locked ? "" : " · edit to tweak"}</span><span className="sp" />
        {s.locked ? null : (
          <button type="button" className="btn" style={{ padding: "5px 10px" }} onClick={() => void s.save()} disabled={s.saving || !s.md.trim() || s.md === s.savedMd}>
            {s.saving ? <Loader size={13} className="spin" aria-hidden /> : <Save size={13} aria-hidden />} Save
          </button>
        )}
      </div>
      <textarea className="lookedit" value={s.md} readOnly={s.locked} onChange={(e) => { if (!s.sel) s.own(null); s.edit(e.target.value); }}
        aria-label="DESIGN.md" spellCheck={false} placeholder="Pick a look above, or paste a DESIGN.md here." />
      <div className="row-f" style={{ marginTop: 6 }}>
        <CheckLine check={s.check} /><span className="sp" />
        {!s.locked && s.md.trim() && s.md !== s.savedMd ? <span className="mono muted">not saved</span> : null}
      </div>
      {s.err ? <div className="err" role="alert">{s.err}</div> : null}
    </div>
  );
}

/** Side card rows: what the build will use. */
export function BuildWith({ s }: { s: SpecLook }) {
  const c = s.check;
  const chip = !c ? ["c-n", "none"] : !c.ok || c.findings.some((f) => f.severity === "error") ? ["c-bad", "error"]
    : c.findings.some((f) => f.severity === "warning") ? ["c-warn", "warnings"] : ["c-ok", "valid"];
  const row = { display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0" } as const;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="label">Build with</div>
      <div style={row}><span>Look</span><b>{s.name ?? "None yet"}</b></div>
      <div style={row}><span>Design skill</span><span className="mono">frontend-design</span></div>
      <div style={row}><span>DESIGN.md check</span><span className={`chip ${chip[0]}`}>{chip[1]}</span></div>
    </div>
  );
}
