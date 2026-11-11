import { Loader } from "lucide-react";

// Shown while a signed-in screen reads its data on the server.
export default function Loading() {
  return (
    <div className="center" role="status" aria-live="polite">
      <div className="muted"><Loader size={14} className="spin" aria-hidden /> <span className="rv-l">Loading…</span><span className="rv-h">Digging…</span></div>
    </div>
  );
}
