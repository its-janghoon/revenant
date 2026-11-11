// Haunted effects layer: dirt, rain, thunder, blood drips, a big strike on death, and sound.
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
    <div id="thunder"><svg id="bolt" viewBox="0 0 100 100" preserveAspectRatio="none"><path/><path class="br"/><path class="br"/></svg></div>`);

  // sound switch sits next to Full / Calm
  const calmSeg = $("#calmseg");
  calmSeg.insertAdjacentHTML("afterend", `<div class="seg snd" id="sndseg"><button data-snd="off">Mute</button><button data-snd="on">Sound</button></div>`);

  const css = document.createElement("style");
  css.textContent = `
  #dirt,#rain,#drips,#thunder{position:fixed;inset:0;pointer-events:none;display:none}
  [data-mode=spooky][data-calm=off] #dirt,[data-mode=spooky][data-calm=off] #rain,[data-mode=spooky][data-calm=off] #drips,[data-mode=spooky][data-calm=off] #thunder{display:block}
  .seg.snd{display:none} [data-mode=spooky][data-calm=off] .seg.snd{display:flex}
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
  #thunder.big{animation:big 1.5s ease-out;mix-blend-mode:normal}
  @keyframes strike{0%{opacity:0}4%{opacity:.75}9%{opacity:.05}14%{opacity:.55}30%{opacity:.08}100%{opacity:0}}
  @keyframes big{0%{opacity:1;background:#fff}6%{opacity:1;background:#fff}7%{opacity:1;background:#000}20%{opacity:1;background:#000}22%{opacity:.9;background:#fff}26%{opacity:0}100%{opacity:0}}
  #bolt{position:absolute;inset:0;width:100%;height:100%}
  #bolt path{fill:none;stroke:#fff;stroke-width:.35;filter:drop-shadow(0 0 1px #fff)}
  #bolt path.br{stroke-width:.18;opacity:.8}
  #thunder.big #bolt path{stroke:#000;stroke-width:.6;filter:none}
  body.lit #dark{opacity:.05!important;transition:none}
  #dark{transition:opacity .9s}
  body.quake main{animation:quake .7s cubic-bezier(.36,.07,.19,.97) both!important}
  @keyframes quake{10%,90%{transform:translate(-2px,1px)}20%,80%{transform:translate(6px,-3px)}30%,50%,70%{transform:translate(-12px,4px) scale(1.01)}40%,60%{transform:translate(12px,-4px)}}
  @media (prefers-reduced-motion:reduce){#thunder,#rain,#drips{display:none!important}}
  `;
  document.head.append(css);

  /* ---------------- sound, made in the browser (no files, no licences) ---------------- */
  let ac = null, rainGain = null, master = null;
  const soundOn = () => on() && root.dataset.snd === "on";
  root.dataset.snd = "off";
  function noiseBuffer(sec, brown) {
    const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function startAudio() {
    if (ac) return ac.resume();
    ac = new AudioContext();
    master = ac.createGain(); master.gain.value = .9; master.connect(ac.destination);
    // rain: looping white noise, band-limited, with slow gusts
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(4, false); src.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
    rainGain = ac.createGain(); rainGain.gain.value = 0;
    const gust = ac.createOscillator(), gustAmt = ac.createGain(); gust.frequency.value = .09; gustAmt.gain.value = .05;
    gust.connect(gustAmt).connect(rainGain.gain); gust.start();
    src.connect(hp).connect(lp).connect(rainGain).connect(master); src.start();
    // droplets on the roof
    (function drop() {
      if (soundOn()) {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
        o.frequency.setValueAtTime(1800 + Math.random() * 2600, t); o.frequency.exponentialRampToValueAtTime(400, t + .05);
        g.gain.setValueAtTime(.025 * Math.random(), t); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
        o.connect(g).connect(master); o.start(t); o.stop(t + .07);
      }
      setTimeout(drop, 20 + Math.random() * 90);
    })();
  }
  function setRain() { if (rainGain) rainGain.gain.setTargetAtTime(soundOn() ? .13 : 0, ac.currentTime, .4); }
  function boom(big, at) {
    if (!ac || (at === undefined && !soundOn())) return;
    const t = at !== undefined ? at : ac.currentTime + (big ? 0 : .25 + Math.random() * .9); // light first, sound after
    // crack
    const c = ac.createBufferSource(); c.buffer = noiseBuffer(.4, false);
    const cf = ac.createBiquadFilter(); cf.type = "highpass"; cf.frequency.value = 1200;
    const cg = ac.createGain(); cg.gain.setValueAtTime(big ? 1 : .35, t); cg.gain.exponentialRampToValueAtTime(.001, t + (big ? .35 : .2));
    c.connect(cf).connect(cg).connect(master); c.start(t);
    // rumble
    const r = ac.createBufferSource(); r.buffer = noiseBuffer(big ? 6 : 4.5, true);
    const rf = ac.createBiquadFilter(); rf.type = "lowpass"; rf.frequency.setValueAtTime(big ? 900 : 500, t); rf.frequency.exponentialRampToValueAtTime(80, t + (big ? 5 : 3.8));
    const rg2 = ac.createGain(); rg2.gain.setValueAtTime(.0001, t); rg2.gain.exponentialRampToValueAtTime(big ? 2.4 : 1.1, t + .08); rg2.gain.exponentialRampToValueAtTime(.001, t + (big ? 5.5 : 4));
    r.connect(rf).connect(rg2).connect(master); r.start(t);
  }
  document.querySelectorAll("#sndseg button").forEach((b) => b.onclick = () => {
    root.dataset.snd = b.dataset.snd;
    if (b.dataset.snd === "on") startAudio();
    paintSnd(); setRain();
  });
  function paintSnd() { document.querySelectorAll("#sndseg button").forEach((b) => b.classList.toggle("on", root.dataset.snd === b.dataset.snd)); }
  paintSnd();
  new MutationObserver(setRain).observe(root, { attributes: true, attributeFilter: ["data-mode", "data-calm"] });

  /* ---------------- rain ---------------- */
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

  /* ---------------- thunder: lightning shows what the flashlight hides ---------------- */
  function jag(x, y, toY, spread) {
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    while (y < toY) { y += 3 + Math.random() * 8; x += (Math.random() - .5) * spread; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`; }
    return { d, x, y };
  }
  function bolt() {
    const main = jag(15 + Math.random() * 70, 0, 100, 9), ps = document.querySelectorAll("#bolt path");
    ps[0].setAttribute("d", main.d);
    ps[1].setAttribute("d", jag(main.x * .9 + 5, 20 + Math.random() * 20, 60, 14).d);
    ps[2].setAttribute("d", jag(main.x * 1.05, 40 + Math.random() * 20, 85, 14).d);
  }
  function thunder(big = false) {
    if (!on()) return;
    bolt();
    const t = $("#thunder"); t.classList.remove("strike", "big"); void t.offsetWidth; t.classList.add(big ? "big" : "strike");
    document.body.classList.add("lit"); setTimeout(() => document.body.classList.remove("lit"), big ? 600 : 380);
    if (big) { document.body.classList.remove("quake"); void document.body.offsetWidth; document.body.classList.add("quake"); setTimeout(() => document.body.classList.remove("quake"), 800); }
    boom(big);
    (window.__ev = window.__ev || []).push({ t: performance.now(), big });
  }
  (function storm() { setTimeout(() => { thunder(); storm(); }, 9000 + Math.random() * 12000); })();

  /* ---------------- blood ---------------- */
  function bleed() {
    if (!on()) return;
    const box = $("#drips"); box.classList.remove("gone"); box.innerHTML = '<div class="smear"></div>';
    for (let i = 0; i < 18; i++) {
      const w = 3 + Math.random() * 7;
      box.insertAdjacentHTML("beforeend", `<div class="drip" style="left:${(Math.random() * 98).toFixed(1)}%;--w:${w.toFixed(1)}px;--h:${(60 + Math.random() * 420) | 0}px;--t:${(2.2 + Math.random() * 3.5).toFixed(2)}s;--d:${(Math.random() * 1.2).toFixed(2)}s"></div>`);
    }
  }
  function clot() { $("#drips").classList.add("gone"); }

  /* ---------------- the scare is a strike right on top of you: white, black, white, a quake and a crack ---------------- */
  function scare() {
    return new Promise((res) => {
      if (!on()) return res();
      window.__scare = true;
      thunder(true);
      setTimeout(res, 380);
    });
  }

  /* render the same sounds offline, for the demo video (events: [{at, big}] in seconds) */
  async function bake(events, dur) {
    const keep = [ac, master], sr = 44100;
    const off = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
    ac = off; master = off.createGain(); master.gain.value = .9; master.connect(off.destination);
    const src = off.createBufferSource(); src.buffer = noiseBuffer(4, false); src.loop = true;
    const hp = off.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    const lp = off.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
    const g = off.createGain(); g.gain.value = .13; src.connect(hp).connect(lp).connect(g).connect(master); src.start(0);
    for (let t = 0; t < dur; t += .02 + Math.random() * .09) {
      const o = off.createOscillator(), og = off.createGain();
      o.frequency.setValueAtTime(1800 + Math.random() * 2600, t); o.frequency.exponentialRampToValueAtTime(400, t + .05);
      og.gain.setValueAtTime(.025 * Math.random() + .0001, t); og.gain.exponentialRampToValueAtTime(.0001, t + .06);
      o.connect(og).connect(master); o.start(t); o.stop(t + .07);
    }
    for (const e of events) boom(e.big, Math.max(0, e.at + (e.big ? 0 : .5)));
    const buf = await off.startRendering();
    [ac, master] = keep;
    const d = buf.getChannelData(0), out = new DataView(new ArrayBuffer(44 + d.length * 2));
    const w = (o, str) => [...str].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); out.setUint32(4, 36 + d.length * 2, true); w(8, "WAVEfmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    let bin = ""; const u = new Uint8Array(out.buffer); for (let i = 0; i < u.length; i += 32768) bin += String.fromCharCode(...u.subarray(i, i + 32768));
    return btoa(bin);
  }

  window.haunt = { thunder, bleed, clot, scare, bake };
})();
