'use client';
// Select mode for Revenant previews (NEXT_PUBLIC_RV_INSPECT=1 only).
// Revenant's Studio sends { type: "rv:inspect", on } and receives
// { type: "rv:select", file, line, label, text, rect } when the user clicks an element.
import { useEffect } from 'react';

const ALLOWED = (process.env.NEXT_PUBLIC_RV_STUDIO_ORIGIN ?? '').split(',').filter(Boolean);

export function RvInspect() {
  useEffect(() => {
    let on = false;
    let parentOrigin = '';
    const box = document.createElement('div');
    Object.assign(box.style, { position: 'fixed', pointerEvents: 'none', outline: '2px solid #3b82f6', outlineOffset: '2px', borderRadius: '4px', zIndex: '2147483647', display: 'none' });
    document.body.appendChild(box);

    const target = (e: Event) => (e.target as Element | null)?.closest?.('[data-rv]') as HTMLElement | null;
    const show = (el: HTMLElement | null) => {
      if (!el) { box.style.display = 'none'; return; }
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    };
    const move = (e: MouseEvent) => { if (on) show(target(e)); };
    const click = (e: MouseEvent) => {
      if (!on) return;
      const el = target(e);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const [file, line] = (el.dataset.rv ?? '').split(/:(?=\d+$)/);
      const r = el.getBoundingClientRect();
      const label = el.getAttribute('aria-label') || el.tagName.charAt(0) + el.tagName.slice(1).toLowerCase();
      window.parent.postMessage({
        type: 'rv:select', file, line: Number(line), label,
        text: (el.innerText || '').trim().slice(0, 120),
        rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      }, parentOrigin || '*');
    };
    const message = (e: MessageEvent) => {
      if (ALLOWED.length && !ALLOWED.includes(e.origin)) return;
      if (e.data?.type !== 'rv:inspect') return;
      parentOrigin = e.origin;
      on = Boolean(e.data.on);
      document.documentElement.style.cursor = on ? 'crosshair' : '';
      if (!on) show(null);
    };
    window.addEventListener('message', message);
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('message', message);
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('click', click, true);
      box.remove();
    };
  }, []);
  return null;
}
