"use client";
// <HauntLayer/>: mount once in the app shell. Renders the overlays (dirt, grain, flashlight,
// red flash, rain, blood, lightning, silhouette) and the haunt CSS. Mark the active area with
// data-haunt-focus (or pass target) so the flashlight lights it before the mouse moves.
import { useEffect, useRef } from "react";
import { bleed, clot, die, mount, rise, thunder } from "./engine";
import { css } from "./style";

const api = { die, rise, thunder, bleed, clot } as const;

// The tiny API: await die() when a deploy dies (then append the failure log line),
// rise() when it is live again, thunder() for a far strike. All no-ops in Light or Calm.
export function useHaunt() {
  return api;
}

export function HauntLayer({ target = "[data-haunt-focus]" }: { target?: string }) {
  const dark = useRef<HTMLDivElement>(null);
  const grain = useRef<HTMLCanvasElement>(null);
  const rain = useRef<HTMLCanvasElement>(null);
  const drips = useRef<HTMLDivElement>(null);
  const bolt = useRef<SVGSVGElement>(null);
  const ghost = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!dark.current || !grain.current || !rain.current || !drips.current || !bolt.current || !ghost.current) return;
    return mount(
      {
        dark: dark.current,
        grain: grain.current,
        rain: rain.current,
        drips: drips.current,
        thunder: bolt.current.parentElement as HTMLDivElement,
        bolt: [...bolt.current.querySelectorAll("path")],
        ghost: ghost.current,
      },
      target,
    );
  }, [target]);

  return (
    <div aria-hidden="true">
      <style>{css}</style>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="rv-dirtf" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves={4} seed={11} />
          <feColorMatrix values="0 0 0 0 .23  0 0 0 0 .15  0 0 0 0 .09  0 0 0 -2.6 1.55" />
        </filter>
        <filter id="rv-stainf" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves={3} seed={4} />
          <feColorMatrix values="0 0 0 0 .09  0 0 0 0 .05  0 0 0 0 .03  0 0 0 -3 1.7" />
        </filter>
        <filter id="rv-bleed">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.09" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={9} />
        </filter>
      </svg>
      <svg className="rv-fx rv-dirt" preserveAspectRatio="none">
        <rect width="100%" height="100%" filter="url(#rv-stainf)" />
        <rect width="100%" height="100%" filter="url(#rv-dirtf)" />
      </svg>
      <canvas ref={grain} className="rv-fx rv-grain" width={720} height={440} />
      <div ref={dark} className="rv-fx rv-dark" />
      <div className="rv-fx rv-flash" />
      <canvas ref={rain} className="rv-fx rv-rain" />
      <div ref={drips} className="rv-fx rv-drips" />
      <div className="rv-fx rv-thunder">
        <svg ref={bolt} className="rv-bolt" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path />
          <path className="br" />
          <path className="br" />
        </svg>
      </div>
      <svg ref={ghost} className="rv-fx rv-ghost" viewBox="0 0 60 160" preserveAspectRatio="xMidYMax meet">
        <circle cx="30" cy="15" r="10.5" fill="#050404" />
        <path
          fill="#050404"
          d="M30 27c-9 0-15 3-18 9-3 7-4 18-5 30l-3 44 7 1 5-38 2 85h10l2-48 2 48h10l2-85 5 38 7-1-3-44c-1-12-2-23-5-30-3-6-9-9-18-9z"
        />
      </svg>
    </div>
  );
}
