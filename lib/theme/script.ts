// Runs in <head> before first paint, so the page never flashes the wrong theme.
// Light is the default; the OS dark setting is ignored. Calm defaults to on when the OS
// asks for reduced motion. Sound always starts muted (the user must press Sound).
export const KEYS = { mode: "rv-mode", calm: "rv-calm" } as const;

export const themeScript = `(function(){var d=document.documentElement;try{var m=localStorage.getItem("${KEYS.mode}"),c=localStorage.getItem("${KEYS.calm}");d.dataset.mode=m==="haunted"?"haunted":"light";d.dataset.calm=c==="on"||c==="off"?c:(matchMedia("(prefers-reduced-motion: reduce)").matches?"on":"off")}catch(e){d.dataset.mode="light";d.dataset.calm="off"}d.dataset.snd="off"})()`;
