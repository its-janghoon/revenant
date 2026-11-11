// CSS for the haunt layer, the tombstone and helper classes. Rendered once by <HauntLayer/>.
// Uses the theme tokens (--bad, --panel, --fg) from the theme module.
const H = "[data-mode=haunted][data-calm=off]";

export const css = `
.rv-fx{position:fixed;inset:0;pointer-events:none;display:none}
${H} .rv-fx{display:block}
.rv-dirt{width:100%;height:100%;z-index:9;opacity:.42;-webkit-mask-image:radial-gradient(ellipse 75% 70% at 50% 45%,transparent 50%,#000 100%);mask-image:radial-gradient(ellipse 75% 70% at 50% 45%,transparent 50%,#000 100%)}
.rv-grain{z-index:10;width:100%;height:100%;opacity:.07;mix-blend-mode:overlay;image-rendering:pixelated}
.rv-dark{z-index:10;background:radial-gradient(circle 420px at var(--x,70%) var(--y,30%),transparent 0,rgba(0,0,0,.18) 45%,rgba(0,0,0,.62) 100%);transition:opacity .9s}
body.rv-lit .rv-dark{opacity:.05;transition:none}
.rv-flash{z-index:10;background:var(--bad);opacity:0}
body.rv-dying .rv-flash{animation:rv-flash 1.2s ease-out}
.rv-rain{z-index:11;width:100%;height:100%;opacity:.55}
.rv-drips{z-index:12}
.rv-drips.gone{transition:opacity 1.6s;opacity:0}
.rv-drip{position:absolute;top:-6px;width:var(--w);height:var(--h);background:linear-gradient(#3d0004,#8f0712 30%,#b3121c);border-radius:0 0 var(--w) var(--w);transform-origin:top;transform:scaleY(0);animation:rv-drip var(--t) cubic-bezier(.55,0,.8,.4) var(--d) forwards;filter:drop-shadow(0 0 2px #0008)}
.rv-drip::after{content:"";position:absolute;bottom:calc(var(--w) * -.6);left:50%;width:calc(var(--w) * 1.9);height:calc(var(--w) * 2.3);transform:translateX(-50%);background:radial-gradient(circle at 40% 35%,#d4303a,#8f0712 60%);border-radius:50% 50% 50% 50%/60% 60% 40% 40%}
.rv-smear{position:absolute;top:0;left:0;right:0;height:22px;background:linear-gradient(#5a0008,transparent);opacity:0;animation:rv-fade .8s forwards}
.rv-thunder{z-index:13;background:#dfe6ff;opacity:0;mix-blend-mode:screen}
.rv-thunder.strike{animation:rv-strike 1.1s ease-out}
.rv-thunder.big{animation:rv-big 1.5s ease-out;mix-blend-mode:normal}
.rv-bolt{position:absolute;inset:0;width:100%;height:100%}
.rv-bolt path{fill:none;stroke:#fff;stroke-width:.35;filter:drop-shadow(0 0 1px #fff)}
.rv-bolt path.br{stroke-width:.18;opacity:.8}
.rv-thunder.big .rv-bolt path{stroke:#000;stroke-width:.6;filter:none}
${H} .rv-ghost{inset:auto;left:var(--gx,80%);top:var(--gy,60%);width:10vh;height:28vh;z-index:14;opacity:0;transform:translate(-50%,-50%);filter:blur(1.5px)}
.rv-ghost.show{animation:rv-ghost 1.5s forwards}
.rv-ghost.gone{visibility:hidden}
${H} main{animation:rv-flicker 7s infinite steps(1)}
${H} body.rv-dying main{animation:rv-shake .5s cubic-bezier(.36,.07,.19,.97) both}
${H} body.rv-quake main{animation:rv-quake .7s cubic-bezier(.36,.07,.19,.97) both}
${H} .rv-glitch{animation:rv-glitch .9s steps(2) 2}
${H} .rv-bleed{filter:url(#rv-bleed)}
.rv-risen{animation:rv-risen 1.6s cubic-bezier(.2,.8,.2,1)}
${H} .rv-bloom{position:relative}
${H} .rv-bloom::before{content:"";position:absolute;inset:-40%;pointer-events:none;background:radial-gradient(circle at 18% 50%,rgba(233,226,210,.16),transparent 40%);animation:rv-bloom 2.4s ease-out forwards}

.rv-tomb{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.rv-card{background:var(--panel);border:1px solid var(--bad);padding:14px 18px;font:12px var(--mono,monospace);color:var(--bad);border-radius:var(--r,8px)}
[data-mode=haunted] .rv-card{border:none;background:none;text-align:center;color:var(--fg)}
.rv-stonewrap{display:none;transition:none}
[data-mode=haunted] .rv-stonewrap{display:block}
.rv-stonewrap.moved{transform:translateY(16px) scale(1.16)}
.rv-stone{width:190px;height:257px;margin:0 auto 6px;display:block;filter:drop-shadow(0 26px 22px #000)}
${H} .rv-stone{transform:translateY(80px);animation:rv-rise 1.4s cubic-bezier(.2,.8,.2,1) forwards}
.rv-stone .bd{fill:#8f0712;transform-box:fill-box;transform-origin:top;transform:scaleY(.6)}
${H} .rv-stone .bd{transform:scaleY(0);animation:rv-drip 4s cubic-bezier(.55,0,.8,.4) .9s forwards}

@keyframes rv-drip{to{transform:scaleY(1)}}
@keyframes rv-fade{to{opacity:.9}}
@keyframes rv-rise{to{transform:none}}
@keyframes rv-strike{0%{opacity:0}4%{opacity:.75}9%{opacity:.05}14%{opacity:.55}30%{opacity:.08}100%{opacity:0}}
@keyframes rv-big{0%{opacity:1;background:#fff}6%{opacity:1;background:#fff}7%{opacity:1;background:#000}20%{opacity:1;background:#000}22%{opacity:.9;background:#fff}26%{opacity:0}100%{opacity:0}}
@keyframes rv-ghost{0%,6%{opacity:.92}6.5%,21.5%{opacity:0}22%,25.5%{opacity:.85}26%,100%{opacity:0}}
@keyframes rv-flash{0%{opacity:.55}8%{opacity:0}14%{opacity:.35}100%{opacity:0}}
@keyframes rv-flicker{0%,100%{opacity:1}41%{opacity:1}41.4%{opacity:.82}41.8%{opacity:1}42.6%{opacity:.9}43%{opacity:1}77%{opacity:1}77.3%{opacity:.86}77.6%{opacity:1}}
@keyframes rv-shake{10%,90%{transform:translate(-1px,0)}20%,80%{transform:translate(3px,-1px)}30%,50%,70%{transform:translate(-6px,2px)}40%,60%{transform:translate(6px,-2px)}}
@keyframes rv-quake{10%,90%{transform:translate(-2px,1px)}20%,80%{transform:translate(6px,-3px)}30%,50%,70%{transform:translate(-12px,4px) scale(1.01)}40%,60%{transform:translate(12px,-4px)}}
@keyframes rv-glitch{0%{text-shadow:2px 0 #ff003c,-2px 0 #00e5ff;clip-path:inset(0 0 60% 0);transform:translate(-3px)}20%{text-shadow:-3px 0 #ff003c,3px 0 #00e5ff;clip-path:inset(40% 0 20% 0);transform:translate(4px)}40%{text-shadow:3px 0 #ff003c,-1px 0 #00e5ff;clip-path:inset(70% 0 0 0);transform:translate(-2px)}60%{text-shadow:-2px 0 #ff003c,2px 0 #00e5ff;clip-path:inset(10% 0 50% 0);transform:translate(2px)}80%,100%{text-shadow:none;clip-path:inset(0);transform:none}}
@keyframes rv-risen{0%{filter:blur(14px);opacity:0;letter-spacing:.3em}100%{filter:blur(0);opacity:1}}
@keyframes rv-bloom{0%{opacity:0}20%{opacity:1}100%{opacity:0}}

@media (prefers-reduced-motion:reduce){
  .rv-fx{display:none!important}
  ${H} main,.rv-glitch,.rv-risen,.rv-stone,.rv-stone .bd,.rv-bloom::before{animation:none!important}
  .rv-stone{transform:none!important}
  .rv-stone .bd{transform:scaleY(.6)!important}
}
`;
