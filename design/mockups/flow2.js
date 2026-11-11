// v2 screens: simpler onboarding, v0/Lovable-style studio and code view, richer admin.
// Loaded after flow.html's own script; overrides S.* and adds new ones.
(() => {
  const H = document.documentElement.dataset.mode === "haunted";
  const w = (a, b) => (H ? b : a);
  const I = (n, s = 16) => `<i data-lucide="${n}" style="width:${s}px;height:${s}px;display:inline-block;vertical-align:-3px"></i>`;
  const PULSE = (c = "currentColor", s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32" fill="none"><path d="M3 18h7l2.5-6 4 12 3-9 1.6 3H29" stroke="${c}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const css = document.createElement("style");
  css.textContent = `
  .logo i{display:none}
  .logo .mk{width:24px;height:24px;border-radius:7px;background:var(--fg);display:grid;place-items:center}
  [data-mode=haunted] .logo .mk{background:var(--accent)}
  .ob{max-width:560px;margin:0 auto;padding-top:70px;text-align:center}
  .ob .big{font:650 34px/1.15 Inter;letter-spacing:-.03em}
  [data-mode=haunted] .ob .big{font:italic 700 42px/1.1 "Cormorant Garamond"}
  .pick{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:26px 0 18px;text-align:left}
  .pick .card{padding:0;overflow:hidden;cursor:pointer}
  .pick .card .pv{height:120px}
  .pick .card .tx{padding:12px 14px}
  .pick .on{outline:2px solid var(--accent);outline-offset:-2px}
  .ok-line{display:flex;gap:16px;justify-content:center;color:var(--muted);font-size:12px;margin-top:16px}
  .ok-line span{display:flex;gap:6px;align-items:center}
  .studio{display:grid;grid-template-columns:400px 1fr;height:calc(100% - 52px)}
  .chat{border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
  .chat .msgs{flex:1;overflow:hidden;padding:18px;display:flex;flex-direction:column;gap:14px}
  .me{align-self:flex-end;background:var(--sunk);border:1px solid var(--line);border-radius:14px 14px 4px 14px;padding:10px 13px;max-width:85%}
  .ai{display:flex;flex-direction:column;gap:8px}
  .think{color:var(--muted);font-size:12px;display:flex;gap:6px;align-items:center}
  .edit{border:1px solid var(--line);border-radius:10px;background:var(--panel);font-size:12px}
  .edit .eh{display:flex;gap:8px;align-items:center;padding:8px 11px;border-bottom:1px solid var(--line)}
  .edit .eb{padding:6px 11px;font:11.5px/1.7 "JetBrains Mono"}
  .composer{margin:0 14px 14px;border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:12px 12px 10px}
  .composer .tools{display:flex;gap:6px;margin-top:10px;align-items:center}
  .pill{display:inline-flex;gap:5px;align-items:center;border:1px solid var(--line);border-radius:99px;padding:4px 10px;font-size:11.5px;color:var(--muted)}
  .pill.on{color:var(--fg);border-color:var(--fg)}
  .pane{display:flex;flex-direction:column;min-height:0}
  .tabs2{display:flex;align-items:center;gap:4px;padding:8px 14px;border-bottom:1px solid var(--line)}
  .tabs2 .t{padding:6px 11px;border-radius:8px;color:var(--muted);font-weight:500;display:flex;gap:6px;align-items:center}
  .tabs2 .t.on{background:var(--sunk);color:var(--fg)}
  .sel{position:absolute;outline:2px solid #3b82f6;outline-offset:2px;border-radius:4px}
  .sel .tag{position:absolute;top:-24px;left:-2px;background:#3b82f6;color:#fff;font:600 10.5px Inter;padding:3px 7px;border-radius:4px 4px 4px 0;white-space:nowrap}
  .pop{position:absolute;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px #0002;padding:10px;width:300px;font-size:12px}
  .code{display:grid;grid-template-columns:220px 1fr;flex:1;min-height:0}
  .tree{border-right:1px solid var(--line);padding:10px 8px;font:12px/1.9 Inter;color:var(--muted)}
  .tree div{padding:0 6px;border-radius:6px;display:flex;gap:6px;align-items:center}
  .tree .on{background:var(--sunk);color:var(--fg)}
  .editor{font:12.5px/1.75 "JetBrains Mono";padding:12px 0;overflow:hidden;background:var(--panel)}
  .editor .ln{display:flex;white-space:pre} .editor .ln i{width:44px;text-align:right;padding-right:14px;color:var(--muted);font-style:normal;opacity:.6}
  .editor .ln.hl{background:color-mix(in srgb,var(--ok) 12%,transparent)}
  .k{color:#a626a4} .s{color:#50a14f} .f{color:#4078f2} .c{color:var(--muted)}
  [data-mode=haunted] .k{color:#c9a0dc} [data-mode=haunted] .s{color:#b6c48a} [data-mode=haunted] .f{color:#d8cdb6}
  .adm{display:grid;grid-template-columns:230px 1fr;height:calc(100% - 52px)}
  .adm aside{border-right:1px solid var(--line);padding:18px 12px;display:flex;flex-direction:column;gap:2px}
  .adm aside a{display:flex;gap:9px;align-items:center;padding:8px 10px;border-radius:8px;color:var(--muted);font-weight:500;text-decoration:none}
  .adm aside a.on{background:var(--sunk);color:var(--fg)}
  .adm aside .grp{font:600 10.5px Inter;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:14px 10px 6px}
  .adm .body{padding:26px 30px;overflow:hidden}
  .spark{display:flex;align-items:flex-end;gap:3px;height:44px;margin-top:10px}
  .spark i{flex:1;background:var(--fg);opacity:.85;border-radius:2px 2px 0 0}
  [data-mode=haunted] .spark i{background:var(--accent)}
  .kpi2{padding:16px 18px} .kpi2 .t{font:500 12px Inter;color:var(--muted);display:flex;gap:6px;align-items:center}
  .kpi2 .n{font:650 28px Inter;letter-spacing:-.03em;margin-top:4px} [data-mode=haunted] .kpi2 .n{font:italic 700 32px "Cormorant Garamond"}
  .delta{font:600 11px Inter;color:var(--ok)}
  .pcard{padding:18px 20px} .pcard .hd{display:flex;gap:10px;align-items:center;margin-bottom:6px} .pcard .hd b{font-size:14px}
  .ic{width:32px;height:32px;border-radius:9px;background:var(--sunk);border:1px solid var(--line);display:grid;place-items:center;flex:none}
  .radio{display:flex;gap:8px;margin-top:12px}
  .radio div{flex:1;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12px}
  .radio div.on{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}
  [data-mode=haunted] .radio div.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
  .radio div b{display:block;font-size:13px}
  .av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:600 10.5px Inter;color:#fff;flex:none}
  `;
  document.head.append(css);

  // header: new mark + lucide nav icons
  const oldHeader = window.header;
  window.header = (active, opts = {}) => oldHeader(active, opts)
    .replace('<div class="logo"><i></i>Revenant', `<div class="logo"><span class="mk">${PULSE(H ? "#f3ebdb" : "#fff", 15)}</span>Revenant`);

  const S = window.S;

  S.signin = () => `<main style="height:100%;display:grid;place-items:center"><div style="width:380px">
    <div class="logo" style="justify-content:center;margin-bottom:26px;font-size:20px"><span class="mk">${PULSE(H ? "#f3ebdb" : "#fff", 15)}</span>Revenant</div>
    <div class="card" style="padding:26px">
      <div class="h" style="font-size:22px;margin-bottom:4px">${w("Sign in", "Enter the crypt")}</div>
      <div class="muted" style="margin-bottom:18px">We email you a 6-digit code. No password.</div>
      <div class="label" style="margin-bottom:6px">Work email</div><div class="input" style="margin-bottom:14px">janghoon@example.com</div>
      <div class="btn" style="width:100%;justify-content:center">${I("mail", 15)} Email me a code</div>
      <div style="display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--muted);font-size:11.5px"><span style="flex:1;height:1px;background:var(--line)"></span>or<span style="flex:1;height:1px;background:var(--line)"></span></div>
      <div class="ghost" style="width:100%;justify-content:center">${I("key-round", 15)} Use a passkey</div>
      <div class="muted" style="margin-top:14px;font-size:11.5px;text-align:center">Amazon Cognito · invite only</div>
    </div></div></main>`;

  S.welcome = () => `${header("")}<main><div class="ob">
    <div class="big">${w("You're in. Let's make your first app.", "You're in. Let's raise your first app.")}</div>
    <div class="muted" style="margin-top:10px;font-size:14px">Pick a look. You can change it any time.</div>
    <div class="pick">
      <div class="card ${H ? "" : "on"}"><div class="pv" style="background:#fbfbfa;border-bottom:1px solid #e7e6e2;padding:14px"><div style="height:10px;width:60%;background:#e7e6e2;border-radius:4px"></div><div style="height:46px;margin-top:12px;border:1px solid #e7e6e2;border-radius:8px;background:#fff"></div></div><div class="tx"><b>${I("sun", 15)} Light</b><div class="muted">Plain. No effects.</div></div></div>
      <div class="card ${H ? "on" : ""}"><div class="pv" style="background:radial-gradient(circle at 30% 30%,#2a2522,#060607 70%);border-bottom:1px solid #241f1b;padding:14px;color:#e9e2d2;font:italic 700 20px 'Cormorant Garamond'">It has risen.</div><div class="tx"><b>${I("ghost", 15)} Haunted</b><div class="muted">Rain, thunder, deploys that die and rise.</div></div></div>
    </div>
    <div class="label" style="text-align:left">Start with</div>
    <div class="card" style="text-align:left;display:flex;gap:14px;align-items:center;padding:14px 16px">
      <div class="ic">${I("file-signature", 17)}</div>
      <div class="sp"><b>FinePrint</b><div class="muted">A contract signing site that flags toxic clauses. Ready in about 20 min.</div></div>
      <span class="btn">${w("Build this", "Raise this")} ${I("arrow-right", 15)}</span></div>
    <div style="margin-top:12px"><span class="muted">or </span><span style="text-decoration:underline">start from a blank prompt</span></div>
    <div class="ok-line"><span>${I("check-circle-2", 13)} AWS 4417-2209-1180</span><span>${I("check-circle-2", 13)} Kiro connected</span><span>${I("check-circle-2", 13)} Budget $200/mo</span></div>
  </div></main>`;

  const chatPane = `<div class="chat"><div class="msgs">
      <div class="me">Make the sign button bigger and put the toxic count next to it in red.</div>
      <div class="ai">
        <div class="think">${I("sparkles", 13)} Thought for 6s · Kiro Auto</div>
        <div>I'll make the button larger and show the toxic clause count beside it, using the review result already on the page.</div>
        <div class="edit"><div class="eh">${I("file-code-2", 14)}<b>app/sign/[id]/page.tsx</b><span class="sp"></span><span class="add">+9</span> <span class="del">−3</span></div>
          <div class="eb"><div class="del">- &lt;Button size="sm"&gt;Sign document&lt;/Button&gt;</div><div class="add">+ &lt;Button size="lg"&gt;Sign document&lt;/Button&gt;</div><div class="add">+ &lt;ToxicCount n={review.toxic} /&gt;</div></div></div>
        <div class="edit"><div class="eh">${I("check", 14)}<span>Preview #16 deployed · 41 s · 8 credits</span></div></div>
      </div>
      <div class="me">Also send me an email when someone signs.</div>
      <div class="ai"><div class="think">${I("loader", 13)} ${w("Working", "Summoning")} · task 2 / 3 · adding a mail function</div></div>
    </div>
    <div class="composer"><div class="muted">${w("Ask Revenant to change anything…", "Whisper a change…")}</div>
      <div class="tools"><span class="pill">${I("paperclip", 13)} Attach</span><span class="pill on">${I("mouse-pointer-2", 13)} Select</span><span class="pill">${I("brain", 13)} Auto</span><span class="sp"></span><span class="btn" style="padding:7px 10px">${I("arrow-up", 15)}</span></div></div></div>`;

  const tabs = (on) => `<div class="tabs2">${[["Preview", "eye"], ["Code", "code-2"], ["Spec", "book-open"], ["Data", "database"], ["Timeline", "activity"]].map(([t, i]) => `<span class="t ${t === on ? "on" : ""}">${I(i, 14)} ${t}</span>`).join("")}
    <span class="sp"></span><span class="pill">${I("monitor", 13)}</span><span class="pill">${I("smartphone", 13)}</span><span class="mono muted">preview-16</span><span class="ghost" style="padding:6px 10px">${I("git-branch", 14)} Branch</span><span class="btn" style="padding:7px 12px">${I("rocket", 14)} Publish</span></div>`;

  S.studio = () => `${header("Apps")}<main class="studio">${chatPane}
    <div class="pane">${tabs("Preview")}
      <div style="flex:1;padding:16px;background:var(--sunk);min-height:0"><div class="frame" style="height:100%;position:relative">
        <div class="url">${I("lock", 11)} preview-16.fineprint.amplifyapp.com</div>
        <div class="site" style="position:relative"><div style="font:600 11px Inter;letter-spacing:.1em;color:#8a857a">FINEPRINT${H ? " · BLOOD OATH" : ""}</div><h2>Read it before you sign it.</h2><div style="color:#6b675e">lease-2026.pdf · 1 toxic clause · 1 to watch</div>
          <div class="doc"><b>12. Liability.</b> <mark>Tenant shall indemnify Landlord against any and all claims, without limit.</mark></div>
          <div style="position:relative;display:inline-flex;align-items:center;gap:12px;margin-top:16px"><span class="b" style="margin:0;padding:12px 22px;font-size:15px">Sign document</span><span style="color:#b3261e;font-weight:700">1 toxic clause</span>
            <div class="sel" style="inset:-6px -8px"><span class="tag">Button · page.tsx:42</span></div></div>
          <div class="pop" style="left:330px;top:250px"><div style="display:flex;gap:6px;margin-bottom:8px"><span class="pill on">Edit with AI</span><span class="pill">Style</span><span class="pill">Text</span></div>
            <div class="input" style="font-size:12px;color:var(--muted)">Make it full width on mobile…</div>
            <div style="display:flex;gap:6px;margin-top:8px"><span class="pill">Color</span><span class="pill">Size lg</span><span class="pill">Radius 4</span></div></div>
        </div></div></div></div></main>`;

  const L = (n, html, hl) => `<div class="ln ${hl ? "hl" : ""}"><i>${n}</i><span>${html}</span></div>`;
  S.code = () => `${header("Apps")}<main class="studio">${chatPane}
    <div class="pane">${tabs("Code")}
      <div class="code">
        <div class="tree">
          <div>${I("folder", 13)} amplify</div><div style="padding-left:20px">${I("file", 12)} backend.ts</div><div style="padding-left:20px">${I("folder", 12)} data</div><div style="padding-left:20px">${I("folder", 12)} functions</div>
          <div>${I("folder-open", 13)} app</div><div style="padding-left:20px">${I("folder-open", 12)} sign/[id]</div><div class="on" style="padding-left:34px">${I("file-code-2", 12)} page.tsx</div>
          <div style="padding-left:20px">${I("file-code-2", 12)} layout.tsx</div><div>${I("folder", 13)} components</div><div>${I("folder", 13)} .kiro</div><div>${I("file", 13)} package.json</div>
        </div>
        <div style="display:flex;flex-direction:column;min-height:0">
          <div class="tabs2" style="padding:6px 12px"><span class="t on">${I("file-code-2", 13)} page.tsx</span><span class="t">backend.ts</span><span class="sp"></span><span class="mono muted">edited by you · not saved</span><span class="ghost" style="padding:5px 10px">Discard</span><span class="btn" style="padding:6px 11px">${I("git-commit-horizontal", 14)} Commit</span></div>
          <div class="editor">
            ${L(38, '<span class="k">export default async function</span> <span class="f">SignPage</span>({ params }) {')}
            ${L(39, '  <span class="k">const</span> review = <span class="k">await</span> <span class="f">getReview</span>(params.id)')}
            ${L(40, '  <span class="k">return</span> (')}
            ${L(41, '    &lt;<span class="f">Actions</span>&gt;')}
            ${L(42, '      &lt;<span class="f">Button</span> size=<span class="s">"lg"</span> onClick={sign}&gt;Sign document&lt;/<span class="f">Button</span>&gt;', true)}
            ${L(43, '      &lt;<span class="f">ToxicCount</span> n={review.toxic} /&gt;', true)}
            ${L(44, '    &lt;/<span class="f">Actions</span>&gt;')}
            ${L(45, '  )')}
            ${L(46, '}')}
            ${L(47, '')}
            ${L(48, '<span class="c">// Kiro reads your edits on the next request, so you and the agent share one codebase.</span>')}
          </div>
          <div style="border-top:1px solid var(--line);padding:8px 14px;display:flex;gap:16px" class="mono muted"><span>${I("git-branch", 12)} preview/16</span><span>CodeCommit rv-fineprint</span><span class="sp"></span><span>${I("terminal", 12)} git clone codecommit::us-east-1://rv-fineprint</span></div>
        </div></div></div></main>`;

  // ---------- admin v2 ----------
  const adminNav = (on) => `<aside>
    <div class="grp">Workspace</div>
    ${[["Overview", "layout-dashboard"], ["Users", "users"], ["Apps", "boxes"]].map(([n, i]) => `<a class="${n === on ? "on" : ""}">${I(i, 16)} ${n}</a>`).join("")}
    <div class="grp">Rules</div>
    ${[["Policy", "shield-check"], ["Kiro", "brain"], ["Budget", "wallet"]].map(([n, i]) => `<a class="${n === on ? "on" : ""}">${I(i, 16)} ${n}</a>`).join("")}
    <div class="grp">Records</div>
    ${[["Audit log", "scroll-text"]].map(([n, i]) => `<a class="${n === on ? "on" : ""}">${I(i, 16)} ${n}</a>`).join("")}
    <span class="sp"></span><div class="card" style="padding:12px;font-size:12px"><b>Install</b><div class="muted mono">v0.1.0 · us-east-1</div><div class="muted mono">acct 4417-2209-1180</div></div></aside>`;
  const adm = (on, body) => `${header("", { admin: true }).replace(/<nav>.*?<\/nav>/, "")}<main class="adm">${adminNav(on)}<div class="body">${body}</div></main>`;
  const spark = (a) => `<div class="spark">${a.map((v) => `<i style="height:${v}%"></i>`).join("")}</div>`;
  const avc = ["#4f46e5", "#0891b2", "#b45309", "#7c3aed", "#475569"];

  S.admin = () => adm("Overview", `
    <div style="display:flex;align-items:center;margin-bottom:18px"><div class="h" style="font-size:28px">Overview</div><span class="sp"></span><span class="pill">Last 30 days ▾</span></div>
    <div class="grid4" style="margin-bottom:16px">
      ${[["AWS spend", "dollar-sign", "$38.20", "of $200 budget", [20, 35, 30, 50, 45, 60, 40, 70, 55, 65, 80, 62]], ["Kiro credits", "brain", "1,840", "Auto · 1× rate", [30, 40, 20, 60, 70, 50, 40, 55, 80, 66, 70, 90]], ["Apps live", "boxes", "9", "23 previews", [40, 40, 50, 50, 55, 60, 60, 70, 70, 75, 80, 85]], ["Auto-repairs", "heart-pulse", "14 / 15", "avg 2m 54s to recover", [10, 30, 0, 20, 40, 10, 50, 30, 20, 60, 40, 30]]]
        .map(([t, i, n, s, a]) => `<div class="card kpi2"><div class="t">${I(i, 14)} ${t}</div><div class="n">${n}</div><div class="muted" style="font-size:12px">${s}</div>${spark(a)}</div>`).join("")}
    </div>
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px">
      <div class="card" style="padding:16px 18px"><div style="display:flex;align-items:center;margin-bottom:6px"><b>Top apps by cost</b><span class="sp"></span><span class="muted">View all ›</span></div>
        <table>${[["fineprint", "Janghoon", "$18.40", 100], ["clinic-book", "Mina", "$9.10", 49], ["waitlist", "Janghoon", "$6.30", 34], ["revenant (itself)", "system", "$4.40", 24]].map(([n, o, c, p]) => `<tr><td><b>${n}</b><div class="muted" style="font-size:11.5px">${o}</div></td><td style="width:45%"><div class="bar"><i style="width:${p}%"></i></div></td><td class="mono" style="text-align:right">${c}</td></tr>`).join("")}</table></div>
      <div class="card" style="padding:16px 18px"><b>Needs attention</b>
        ${[["alert-triangle", "c-warn", "Forecast hits 80% of budget on Nov 26"], ["user-plus", "c-n", "2 invites not accepted yet"], ["skull", "c-bad", "waitlist: repair 2 of 3 failed"]].map(([i, c, t]) => `<div class="row"><span class="chip ${c}" style="padding:5px">${I(i, 13)}</span><div class="t sp">${t}</div><span class="muted">›</span></div>`).join("")}</div>
    </div>`);

  S.policy = () => adm("Policy", `
    <div class="h" style="font-size:28px;margin-bottom:4px">Policy</div><div class="muted" style="margin-bottom:18px">Rules for every app built on this install. Changes apply to the next build.</div>
    <div class="grid2">
      <div class="card pcard"><div class="hd"><div class="ic">${I("database", 16)}</div><b>Databases</b></div><div class="muted">What new apps may use to store data.</div>
        <div class="radio"><div class="on"><b>Amplify Data only</b>No extra database. Cheapest, fastest.</div><div><b>Allow SQL</b>Kiro may add Aurora Postgres when the spec needs it.</div></div>
        <div class="row" style="margin-top:6px"><div class="t sp"><b>SQL allowed for</b><span>Overrides the choice above</span></div><span class="pill">mina@ ✕</span><span class="pill">+ Add</span></div></div>
      <div class="card pcard"><div class="hd"><div class="ic">${I("brain", 16)}</div><b>Kiro</b></div><div class="muted">Who pays for agent work, and which model runs it.</div>
        <div class="radio"><div><b>Company key</b>One Kiro account pays for everyone.</div><div class="on"><b>Bring your own</b>Each person connects their own Kiro.</div></div>
        <div class="row" style="margin-top:6px"><div class="t sp"><b>Model</b><span>Auto picks per step at 1× credits</span></div><div class="input" style="width:170px">Auto (recommended) ▾</div></div></div>
      <div class="card pcard"><div class="hd"><div class="ic">${I("wallet", 16)}</div><b>Budget</b></div>
        <div class="row"><div class="t sp"><b>Monthly AWS budget</b><span>Warn at 80%, pause new builds at 100%</span></div><div class="input mono" style="width:110px">$200</div></div>
        <div class="row"><div class="t sp"><b>Kiro credits per build</b><span>Stop a build that goes over</span></div><div class="input mono" style="width:110px">300</div></div></div>
      <div class="card pcard"><div class="hd"><div class="ic">${I("timer", 16)}</div><b>Cleanup</b></div>
        <div class="row"><div class="t sp"><b>Delete previews after</b><span>Also when merged</span></div><div class="input" style="width:130px">7 days ▾</div></div>
        <div class="row"><div class="t sp"><b>Delete apps after</b><span>For demos and trials</span></div><div class="input" style="width:130px">Never ▾</div></div></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;align-items:center"><span class="btn">Save changes</span><span class="ghost">Cancel</span><span class="muted">${I("scroll-text", 13)} Saved to the audit log</span></div>`);

  S.users = () => adm("Users", `
    <div style="display:flex;align-items:center;margin-bottom:16px"><div class="h" style="font-size:28px">Users</div><span class="sp"></span><div class="input" style="width:240px;margin-right:10px">${I("search", 14)} <span class="muted">Search people</span></div><span class="btn">${I("user-plus", 15)} Invite</span></div>
    <div class="card" style="padding:4px 8px"><table><tr><th>Person</th><th>Role</th><th>Kiro</th><th>SQL</th><th>Apps</th><th>AWS / mo</th><th>Credits / mo</th><th></th></tr>
    ${[["JL", "Janghoon Lee", "janghoon@example.com", "Admin", "own · Pro+", "policy", 4, "$24.80", 1210], ["MP", "Mina Park", "mina@example.com", "Member", "own · Pro", "on", 2, "$7.10", 380], ["SY", "Seo Yun", "seo@example.com", "Admin", "company", "policy", 1, "$3.00", 150], ["J1", "Judge 01", "judge01@demo", "Judge", "company", "off", 1, "$0.90", 100], ["AK", "Alex Kim", "alex@example.com", "Disabled", "not connected", "off", 0, "$0.00", 0]]
      .map(([a, n, e, r, k, s, ap, c, cr], i) => `<tr><td><div style="display:flex;gap:10px;align-items:center"><span class="av" style="background:${avc[i]}">${a}</span><div><b>${n}</b><div class="muted" style="font-size:11.5px">${e}</div></div></div></td>
        <td><span class="chip ${r === "Admin" ? "c-warn" : r === "Disabled" ? "c-bad" : "c-n"}">${r}</span></td><td class="muted">${k}</td><td><span class="chip ${s === "on" ? "c-ok" : "c-n"}">${s}</span></td><td class="mono">${ap}</td><td class="mono">${c}</td><td class="mono">${cr}</td><td class="muted">${I("more-horizontal", 15)}</td></tr>`).join("")}</table></div>`);

  S.apps = () => adm("Apps", `
    <div style="display:flex;align-items:center;margin-bottom:16px"><div class="h" style="font-size:28px">Apps</div><span class="sp"></span><span class="pill on">All 9</span>&nbsp;<span class="pill">Live 6</span>&nbsp;<span class="pill">Failing 1</span>&nbsp;<span class="pill">Expiring 1</span></div>
    <div class="card" style="padding:4px 8px"><table><tr><th>App</th><th>Owner</th><th>Data</th><th>Health</th><th>Previews</th><th>AWS / mo</th><th>Repairs</th><th></th></tr>
    ${[["fineprint", "Janghoon", "Amplify Data", "c-ok", "live", 3, "$18.40", "3 / 3"], ["clinic-book", "Mina", "Aurora (SQL)", "c-warn", "building", 1, "$9.10", "0"], ["waitlist", "Janghoon", "Amplify Data", "c-bad", "failing", 2, "$6.30", "1 / 2"], ["judge01-todo", "Judge 01", "Amplify Data", "c-n", "deletes in 9 h", 0, "$0.90", "0"]]
      .map(([n, o, d, c, s, p, m, r]) => `<tr><td><div style="display:flex;gap:10px;align-items:center"><span class="ic" style="width:28px;height:28px">${I("box", 14)}</span><b>${n}</b></div></td><td>${o}</td><td class="muted">${d}</td><td><span class="chip ${c}">${s}</span></td><td class="mono">${p}</td><td class="mono">${m}</td><td class="mono">${r}</td><td class="muted">${I("external-link", 14)} &nbsp; ${I("trash-2", 14)}</td></tr>`).join("")}</table></div>`);

  S.audit = () => adm("Audit log", `
    <div class="h" style="font-size:28px;margin-bottom:16px">Audit log</div>
    <div class="card" style="padding:4px 8px"><table><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr>
    ${[["14:21", "Janghoon", "policy.sql_user_on", "mina@example.com"], ["14:05", "Kiro · repair", "repair.merged", "waitlist · fix-3 · SEAL_SECRET"], ["13:40", "Janghoon", "publish.approved", "fineprint · remove Contract.draftNote (42 records)"], ["11:02", "Seo", "app.deleted", "old-landing"], ["09:15", "system", "preview.expired", "fineprint · preview/9"]]
      .map(([a, b, c, d]) => `<tr><td class="mono muted">${a}</td><td>${b}</td><td class="mono">${c}</td><td class="muted">${d}</td></tr>`).join("")}</table></div>`);

  window.SCREENS = Object.keys(S);
})();
