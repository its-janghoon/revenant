"use client";
// A screen failed to load (AWS or the database did not answer). The header stays; the user can retry.
import Link from "next/link";

export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="center">
      <div className="card" style={{ maxWidth: 420, textAlign: "center" }} role="alert">
        <h1 className="h" style={{ fontSize: 22, marginBottom: 6 }}>
          <span className="rv-l">This screen did not load</span><span className="rv-h">Something stirred in the dark</span>
        </h1>
        <div className="muted" style={{ marginBottom: 14 }}>
          Revenant could not read its data. The database may be waking up; try again in a few seconds.
          {error.digest ? <div className="mono" style={{ fontSize: 11.5, marginTop: 6 }}>ref {error.digest}</div> : null}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button type="button" className="btn" onClick={reset}>Try again</button>
          <Link href="/" className="ghost">Home</Link>
        </div>
      </div>
    </div>
  );
}
