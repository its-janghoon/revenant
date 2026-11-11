"use client";
// <Tombstone/>: put it inside the dead preview frame (position: relative).
// Light: a plain red card. Haunted: a weathered stone with moss, a crack, soil and blood
// that runs from the number. After the death strike it stands a little closer.
import { useId, useSyncExternalStore } from "react";
import { store } from "./engine";

export function Tombstone({ title, number, code }: { title: string; number?: string; code?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const moved = useSyncExternalStore(store.subscribe, store.moved, () => false);
  const u = (n: string) => `url(#${n}${id})`;

  return (
    <div className="rv-tomb">
      <div className="rv-card">
        <div className={moved ? "rv-stonewrap moved" : "rv-stonewrap"}>
          <svg className="rv-stone" viewBox="0 0 170 230" aria-hidden="true">
            <defs>
              <filter id={`rock${id}`} x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={4} seed={7} result="n" />
                <feDiffuseLighting in="n" lightingColor="#9a9187" surfaceScale={2.4} result="l">
                  <feDistantLight azimuth={235} elevation={50} />
                </feDiffuseLighting>
                <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} />
              </filter>
              <filter id={`moss${id}`} x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves={3} seed={2} />
                <feColorMatrix values="0 0 0 0 .14  0 0 0 0 .15  0 0 0 0 .09  0 0 0 -2.2 .7" />
              </filter>
              <filter id={`soil${id}`} x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={3} seed={9} result="n" />
                <feDiffuseLighting in="n" lightingColor="#4a3424" surfaceScale={3}>
                  <feDistantLight azimuth={240} elevation={40} />
                </feDiffuseLighting>
              </filter>
              <clipPath id={`tshape${id}`}>
                <path d="M18 200 V78 Q18 10 85 10 Q152 10 152 78 V200 Z" />
              </clipPath>
              <clipPath id={`mshape${id}`}>
                <path d="M0 230 Q10 196 50 194 Q85 186 120 194 Q160 196 170 230 Z" />
              </clipPath>
              <linearGradient id={`tdark${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopOpacity="0" />
                <stop offset="1" stopOpacity=".75" />
              </linearGradient>
            </defs>
            <g clipPath={u("tshape")}>
              <rect width="170" height="230" fill="#fff" />
              <rect width="170" height="230" fill="#fff" filter={u("rock")} />
              <rect width="170" height="230" fill="#3b3631" style={{ mixBlendMode: "multiply" }} />
              <rect width="170" height="230" filter={u("moss")} opacity=".7" />
              <rect width="170" height="230" fill={u("tdark")} />
              <path d="M118 22 L110 46 L116 58 L104 84 M110 46 L98 52 M40 150 L52 168 L46 186" stroke="#120f0d" strokeWidth="1.6" fill="none" />
            </g>
            <path d="M18 200 V78 Q18 10 85 10 Q152 10 152 78 V200" stroke="#0e0c0b" strokeWidth="3" fill="none" />
            <text x="85" y="64" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="15" letterSpacing="4" fill="#d9d1c2" opacity=".35">
              R I P
            </text>
            {number && (
              <>
                <text x="85" y="114" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontStyle="italic" fontWeight="700" fontSize="40" fill="#0d0a09">
                  {number}
                </text>
                <text x="84" y="113" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontStyle="italic" fontWeight="700" fontSize="40" fill="#6d0a10">
                  {number}
                </text>
              </>
            )}
            <g>
              <rect className="bd" x="68" y="114" width="3" height="58" rx="1.5" />
              <rect className="bd" x="86" y="116" width="4" height="78" rx="2" style={{ animationDelay: ".5s" }} />
              <rect className="bd" x="99" y="114" width="2.5" height="40" rx="1.2" style={{ animationDelay: "1.1s" }} />
            </g>
            {code && (
              <text x="85" y="150" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="7.5" fill="#cfc6b3" opacity=".55">
                {code}
              </text>
            )}
            <g clipPath={u("mshape")}>
              <rect width="170" height="230" fill="#fff" filter={u("soil")} />
              <rect width="170" height="230" fill="#2a1d14" style={{ mixBlendMode: "multiply" }} />
            </g>
          </svg>
        </div>
        <div>{title}</div>
      </div>
    </div>
  );
}
