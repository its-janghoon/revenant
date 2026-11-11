// Haunted effects layer: rain, thunder, dirt, blood drips, jump scare.
// Everything here does nothing in Light or in Haunted Calm.
(() => {
  const root = document.documentElement;
  const on = () => root.dataset.mode === "spooky" && root.dataset.calm === "off";
  const $ = (s) => document.querySelector(s);

  document.body.insertAdjacentHTML("beforeend", `
    <svg width="0" height="0" style="position:absolute">
      <filter id="dirtf" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="4" seed="11"/>
        <feColorMatrix values="0 0 0 0 .23  0 0 0 0 .15  0 0 0 0 .09  0 0 0 -2.6 1.55"/>
      </filter>
      <filter id="stainf" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="3" seed="4"/>
        <feColorMatrix values="0 0 0 0 .09  0 0 0 0 .05  0 0 0 0 .03  0 0 0 -3 1.7"/>
      </filter>
    </svg>
    <svg id="dirt" preserveAspectRatio="none"><rect width="100%" height="100%" filter="url(#stainf)"/><rect width="100%" height="100%" filter="url(#dirtf)"/></svg>
    <canvas id="rain"></canvas>
    <div id="drips"></div>
    <div id="thunder"><svg id="bolt" viewBox="0 0 100 100" preserveAspectRatio="none"><path/></svg></div>
    <div id="scare"><svg class="face" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="warp" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".035 .08" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="18"/></filter>
        <filter id="skin" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="8"/><feColorMatrix values="0 0 0 0 .8  0 0 0 0 .78  0 0 0 0 .74  0 0 0 .9 -.3"/></filter>
        <clipPath id="facec"><path d="M100 8 C150 8 172 52 168 112 C165 160 140 214 112 240 C104 248 96 248 88 240 C60 214 35 160 32 112 C28 52 50 8 100 8Z"/></clipPath>
        <radialGradient id="pale" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#b9b3a8"/><stop offset=".55" stop-color="#5b5650"/><stop offset="1" stop-color="#0a0908"/></radialGradient>
        <radialGradient id="hole" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#000"/><stop offset=".7" stop-color="#050404"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <g filter="url(#warp)">
        <path d="M100 8 C150 8 172 52 168 112 C165 160 140 214 112 240 C104 248 96 248 88 240 C60 214 35 160 32 112 C28 52 50 8 100 8Z" fill="url(#pale)"/>
        <ellipse cx="70" cy="112" rx="26" ry="30" fill="url(#hole)"/><ellipse cx="130" cy="112" rx="26" ry="30" fill="url(#hole)"/>
        <ellipse cx="62" cy="168" rx="18" ry="30" fill="#000" opacity=".35"/><ellipse cx="138" cy="168" rx="18" ry="30" fill="#000" opacity=".35"/>
        <path d="M95 140 L100 160 L105 140Z" fill="#000" opacity=".7"/>
        <path d="M74 196 Q100 230 126 196 Q100 206 74 196Z" fill="#000"/>
        <circle cx="72" cy="116" r="2.2" fill="#ff1f1f"/><circle cx="128" cy="116" r="2.2" fill="#ff1f1f"/>
      </g>
      <rect width="200" height="260" filter="url(#skin)" opacity=".5" clip-path="url(#facec)"/>
    </svg></div>`);

  const css = document.createElement("style");
  css.textContent = `
  #dirt,#rain,#drips,#thunder,#scare{position:fixed;inset:0;pointer-events:none;display:none}
  [data-mode=spooky][data-calm=off] #dirt,[data-mode=spooky][data-calm=off] #rain,[data-mode=spooky][data-calm=off] #drips,[data-mode=spooky][data-calm=off] #thunder,[data-mode=spooky][data-calm=off] #scare{display:block}
  #dirt{width:100%;height:100%;z-index:9;opacity:.42;-webkit-mask-image:radial-gradient(ellipse 75% 70% at 50% 45%,transparent 50%,#000 100%);mask-image:radial-gradient(ellipse 75% 70% at 50% 45%,transparent 50%,#000 100%)}
  #rain{z-index:11;width:100%;height:100%;opacity:.55}
  #drips{z-index:12}
  .drip{position:absolute;top:-6px;width:var(--w);height:var(--h);background:linear-gradient(#3d0004,#8f0712 30%,#b3121c);border-radius:0 0 var(--w) var(--w);transform-origin:top;transform:scaleY(0);animation:drip var(--t) cubic-bezier(.55,0,.8,.4) var(--d) forwards;filter:drop-shadow(0 0 2px #0008)}
  .drip::after{content:"";position:absolute;bottom:calc(var(--w) * -.6);left:50%;width:calc(var(--w) * 1.9);height:calc(var(--w) * 2.3);transform:translateX(-50%);background:radial-gradient(circle at 40% 35%,#d4303a,#8f0712 60%);border-radius:50% 50% 50% 50%/60% 60% 40% 40%}
  .smear{position:absolute;top:0;left:0;right:0;height:22px;background:linear-gradient(#5a0008,transparent);opacity:0;animation:fade .8s forwards}
  @keyframes drip{to{transform:scaleY(1)}}
  @keyframes fade{to{opacity:.9}}
  #drips.gone{transition:opacity 1.6s;opacity:0}
  #thunder{z-index:13;background:#dfe6ff;opacity:0;mix-blend-mode:screen}
  #thunder.strike{animation:strike 1.1s ease-out}
  @keyframes strike{0%{opacity:0}4%{opacity:.75}9%{opacity:.05}14%{opacity:.55}30%{opacity:.08}100%{opacity:0}}
  #bolt{position:absolute;inset:0;width:100%;height:100%}
  #bolt path{fill:none;stroke:#fff;stroke-width:.35;filter:drop-shadow(0 0 1px #fff)}
  body.lit #dark{opacity:.05!important;transition:none}
  #dark{transition:opacity .9s}
  #scare{z-index:20;background:#000;opacity:0}
  #scare.go{animation:scare .62s steps(1) forwards}
  @keyframes scare{0%{opacity:1}92%{opacity:1}100%{opacity:0}}
  #scare .face{position:absolute;left:50%;top:50%;height:92vh;width:auto;aspect-ratio:200/260;transform:translate(-50%,-50%) scale(.7);filter:contrast(1.4)}
  #scare.go .face{animation:lunge .6s cubic-bezier(.1,.9,.2,1) forwards}
  @keyframes lunge{0%{transform:translate(-50%,-50%) scale(.7)}30%{transform:translate(-52%,-49%) scale(1.05)}31%{transform:translate(-47%,-51%) scale(1.06);filter:contrast(1.4) hue-rotate(-20deg) saturate(3)}60%{transform:translate(-50%,-50%) scale(1.25)}100%{transform:translate(-50%,-50%) scale(1.45)}}
  #scare::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px);mix-blend-mode:overlay}
  @media (prefers-reduced-motion:reduce){#scare,#thunder,#rain,#drips{display:none!important}}
  `;
  document.head.append(css);

  /* rain */
  const rc = $("#rain"), rg = rc.getContext("2d");
  const fit = () => { rc.width = innerWidth; rc.height = innerHeight; };
  fit(); addEventListener("resize", fit);
  const drops = Array.from({ length: 260 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, l: 10 + Math.random() * 22, v: 14 + Math.random() * 12 }));
  (function rain() {
    if (on()) {
      rg.clearRect(0, 0, rc.width, rc.height);
      rg.strokeStyle = "rgba(200,205,215,.28)"; rg.lineWidth = 1; rg.beginPath();
      for (const d of drops) {
        rg.moveTo(d.x, d.y); rg.lineTo(d.x - d.l * .18, d.y + d.l);
        d.y += d.v; d.x -= d.v * .18;
        if (d.y > rc.height) { d.y = -d.l; d.x = Math.random() * (rc.width + 200); }
      }
      rg.stroke();
    }
    requestAnimationFrame(rain);
  })();

  /* thunder: lightning reveals everything the flashlight hides */
  function bolt() {
    let x = 15 + Math.random() * 70, y = 0, d = `M${x} 0`;
    while (y < 100) { y += 4 + Math.random() * 9; x += (Math.random() - .5) * 9; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`; }
    $("#bolt path").setAttribute("d", d);
  }
  function thunder() {
    if (!on()) return;
    bolt();
    const t = $("#thunder"); t.classList.remove("strike"); void t.offsetWidth; t.classList.add("strike");
    document.body.classList.add("lit"); setTimeout(() => document.body.classList.remove("lit"), 380);
  }
  (function storm() { setTimeout(() => { thunder(); storm(); }, 9000 + Math.random() * 12000); })();

  /* blood */
  function bleed() {
    if (!on()) return;
    const box = $("#drips"); box.classList.remove("gone"); box.innerHTML = '<div class="smear"></div>';
    for (let i = 0; i < 18; i++) {
      const w = 3 + Math.random() * 7;
      box.insertAdjacentHTML("beforeend", `<div class="drip" style="left:${(Math.random() * 98).toFixed(1)}%;--w:${w.toFixed(1)}px;--h:${(60 + Math.random() * 420) | 0}px;--t:${(2.2 + Math.random() * 3.5).toFixed(2)}s;--d:${(Math.random() * 1.2).toFixed(2)}s"></div>`);
    }
  }
  function clot() { $("#drips").classList.add("gone"); }

  /* jump scare: once per page, only in Full */
  let scared = false;
  function scare() {
    return new Promise((res) => {
      if (!on() || scared) return res();
      scared = true; window.__scare = true;
      const s = $("#scare"); s.classList.add("go");
      setTimeout(() => { s.classList.remove("go"); res(); }, 620);
    });
  }

  window.haunt = { thunder, bleed, clot, scare };
})();
