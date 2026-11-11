// Logo option A "Pulse" (design/mockups/logos.html): a flat line that beats once.
// Mark on a rounded square: fg in Light, blood red in Haunted (--logo in tokens.css).
export function PulseMark({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M3 18h7l2.5-6 4 12 3-9 1.6 3H29" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <a href="/" className="rv-logo" aria-label="Revenant home">
      <span className="rv-mark"><PulseMark size={16} color="#fff" /></span>
      <span>Revenant</span>
    </a>
  );
}
