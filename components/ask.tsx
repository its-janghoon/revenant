"use client";
// Home prompt (flow.html S.home): the request, attachments, example chips, "Write the spec".
import { Loader, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Project } from "@/lib/contracts";
import { api } from "./api";
import { W } from "./words";

const EXAMPLES: [string, string, boolean][] = [
  ["FinePrint (example)", "Build me a contract signing site where an AI flags toxic clauses before you sign.", true],
  ["Booking site for my clinic", "Build me a booking site for my clinic: patients pick a doctor and a free slot, get an email confirmation, and staff see the day's bookings.", false],
  ["Waitlist with payments", "Build me a waitlist page where people pay a $5 deposit to reserve a spot, with an admin list of everyone who joined.", false],
  ["Internal orders admin", "Build me an internal orders admin: list, search and edit orders, change their status, and export a CSV.", false],
];

interface Upload { key: string; name: string; type: string }

export function Ask() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [example, setExample] = useState(false);
  const [files, setFiles] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function attach(list: FileList | null) {
    if (!list?.length) return;
    setErr(""); setUploading(true);
    try {
      for (const f of Array.from(list).slice(0, 10 - files.length)) {
        const u = await api<Upload & { url: string }>("/api/uploads", { body: { name: f.name, type: f.type, size: f.size } });
        const put = await fetch(u.url, { method: "PUT", body: f, headers: { "content-type": u.type } });
        if (!put.ok) throw new Error(`Upload of ${f.name} failed`);
        setFiles((x) => [...x, { key: u.key, name: u.name, type: u.type }]);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function go() {
    if (text.trim().length < 3) { setErr("Say what the app should do"); return; }
    setErr(""); setBusy(true);
    try {
      const r = await api<{ project: Project }>("/api/projects", { body: { request: text.trim(), attachments: files, ...(example ? { example: "fineprint" } : {}) } });
      router.push(`/p/${r.project.id}/spec`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card ask" data-haunt-focus>
        <textarea id="ask" aria-label="What should we build?" value={text} placeholder="Build me a…" rows={3}
          onChange={(e) => { setText(e.target.value); setExample(false); }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void go(); }} />
        <div className="tools">
          <button type="button" className="pill" onClick={() => input.current?.click()} disabled={uploading}>
            {uploading ? <Loader size={13} className="spin" aria-hidden /> : <Paperclip size={13} aria-hidden />} Attach
          </button>
          {files.map((f) => (
            <span key={f.key} className="pill on">
              {f.name}
              <button type="button" aria-label={`Remove ${f.name}`} style={{ all: "unset", cursor: "pointer", display: "flex" }} onClick={() => setFiles((x) => x.filter((y) => y.key !== f.key))}>
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}
          <input ref={input} type="file" multiple hidden onChange={(e) => attach(e.target.files)} />
        </div>
        <button type="button" className="btn go" onClick={go} disabled={busy || uploading}>
          {busy ? <Loader size={14} className="spin" aria-hidden /> : null} <W k="writeSpec" />
        </button>
      </div>
      {err ? <div className="err" role="alert" style={{ textAlign: "center" }}>{err}</div> : null}
      <div className="examples">
        {EXAMPLES.map(([label, req, ex]) => (
          <button key={label} type="button" className="ghost" onClick={() => { setText(req); setExample(ex); }}>{label}</button>
        ))}
      </div>
    </>
  );
}
