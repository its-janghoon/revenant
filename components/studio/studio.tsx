"use client";
// Studio (flow2.js S.studio / S.code): chat on the left; Preview, Code, Spec, Data and Timeline
// on the right. Live data by polling; a deploy that dies calls die(), one that comes back rise().
import { Activity, BookOpen, Code2, Database, Eye, GitBranch, Monitor, Rocket, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineEvent } from "@/lib/contracts";
import type { Detail, InspectOut } from "@/app/_lib/types";
import { readEvent } from "@/app/_lib/events";
import { useHaunt } from "@/lib/haunt";
import { api } from "../api";
import { usePoll, useTimeline } from "../poll";
import { W } from "../words";
import { Chat } from "./chat";
import { Code } from "./code";
import { DataPane, SpecPane, TimelinePane } from "./panes";
import { Preview } from "./preview";
import { deployNo, fast, previewNo, pulse } from "./state";

export type Tab = "preview" | "code" | "spec" | "data" | "timeline";
const TABS: [Tab, string, typeof Eye][] = [["preview", "Preview", Eye], ["code", "Code", Code2], ["spec", "Spec", BookOpen], ["data", "Data", Database], ["timeline", "Timeline", Activity]];

export function Studio({ initial, events: ev0, tab: tab0 = "preview" }: { initial: Detail; events: TimelineEvent[]; tab?: Tab }) {
  const id = initial.project.id;
  const { data: d, refresh } = usePoll<Detail>(`/api/projects/${id}`, initial, (x) => (fast(x) ? 3000 : 15000));
  const { events: raw, pull } = useTimeline<TimelineEvent>(id, ev0, fast(d));
  const events = useMemo(() => raw.map(readEvent), [raw]);
  const [tab, setTab] = useState<Tab>(tab0);
  const [phone, setPhone] = useState(false);
  const [selectOn, setSelectOn] = useState(false);
  const [selection, setSelection] = useState<InspectOut | null>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [branch, setBranch] = useState(initial.branch);
  const [pickBranch, setPickBranch] = useState(false);
  const { die, rise } = useHaunt();
  const state = pulse(d);
  const prev = useRef(state);

  // the work branch moves when a change opens a new preview; follow it unless the user picked one
  const followed = useRef(true);
  useEffect(() => { if (followed.current) setBranch(d.branch); }, [d.branch]);

  useEffect(() => {
    const was = prev.current;
    prev.current = state;
    if (was !== "dead" && state === "dead") void die();
    if (was === "dead" && (state === "alive" || state === "repair")) rise();
  }, [state, die, rise]);

  useEffect(() => { if (selectOn) setTab("preview"); }, [selectOn]);

  const lastDeploy = d.deploys[0];
  const branches = [...new Set([d.branch, ...d.previews.filter((p) => !p.deletedAt).map((p) => p.branch), ...(d.project.status === "live" ? ["main"] : []), "rv/spec"])];
  const viewUrl = branch === d.branch ? d.previewUrl : d.deploys.find((x) => x.branch === branch && x.url)?.url ?? null;
  const failed = [...events].reverse().find((e) => e.kind === "deploy_failed" || (e.kind === "message" && e.from === "runner" && e.text && /fail/i.test(e.text)));
  const reason = d.repairs[0]?.cause ?? failed?.text ?? null;

  const refreshAll = () => { void refresh(); void pull(); };

  return (
    <div className="studio">
      <Chat d={d} events={events} selection={selection} clearSelection={() => setSelection(null)} selectOn={selectOn} setSelectOn={setSelectOn}
        openFile={(p) => { setOpenPath(p); setTab("code"); }} onSent={refreshAll} />
      <div className="pane">
        <div className="tabs2" role="tablist">
          {TABS.map(([k, label, Icon]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className="t" onClick={() => setTab(k)}><Icon size={14} aria-hidden /> {label}</button>
          ))}
          <span className="sp" />
          {tab === "preview" ? (
            <>
              <button type="button" className="pill" aria-pressed={!phone} aria-label="Desktop width" onClick={() => setPhone(false)}><Monitor size={13} aria-hidden /></button>
              <button type="button" className="pill" aria-pressed={phone} aria-label="Phone width" onClick={() => setPhone(true)}><Smartphone size={13} aria-hidden /></button>
            </>
          ) : null}
          <span className="mono muted">{previewNo(branch) ? `preview-${previewNo(branch)}` : branch}</span>
          <div style={{ position: "relative" }}>
            <button type="button" className="ghost" style={{ padding: "6px 10px" }} aria-haspopup="listbox" aria-expanded={pickBranch} onClick={() => setPickBranch(!pickBranch)}>
              <GitBranch size={14} aria-hidden /> Branch
            </button>
            {pickBranch ? (
              <div className="menu" role="listbox">
                {branches.map((b) => (
                  <button key={b} type="button" role="option" aria-selected={b === branch} onClick={() => { followed.current = b === d.branch; setBranch(b); setPickBranch(false); }}>
                    <GitBranch size={13} aria-hidden /> {b}{b === d.branch ? " · current" : ""}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Link href={`/p/${id}/publish`} className="btn" style={{ padding: "7px 12px" }} aria-disabled={!d.previews.some((p) => !p.deletedAt)}>
            <Rocket size={14} aria-hidden /> <W k="publishNow" />
          </Link>
        </div>
        {tab === "preview" ? (
          <Preview url={viewUrl} state={state} deployNo={lastDeploy ? deployNo(d, lastDeploy.id) : d.deploys.length + 1} reason={reason} phone={phone}
            selectOn={selectOn} selection={selection} onSelect={setSelection}
            onAsk={async (text, s) => {
              await api(`/api/projects/${id}/change`, { body: { text, select: { file: s.file, line: s.line } } });
              setSelection(null);
              refreshAll();
            }} />
        ) : tab === "code" ? (
          <Code projectId={id} repo={d.project.repo} region={d.region} branch={branch} openPath={openPath} onOpened={() => setOpenPath(null)} />
        ) : tab === "spec" ? <SpecPane d={d} />
          : tab === "data" ? <DataPane d={d} branch={branch} />
          : <TimelinePane d={d} events={events} state={state} />}
      </div>
    </div>
  );
}
