"use client";
// An admin page failed to load (Cognito, Cost Explorer or the database did not answer).
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" role="alert" style={{ padding: "16px 18px", maxWidth: 520 }}>
      <b>This page did not load.</b>
      <div className="muted" style={{ margin: "6px 0 12px" }}>
        Cognito or the database did not answer. Try again in a few seconds.
        {error.digest ? <span className="mono"> · ref {error.digest}</span> : null}
      </div>
      <button type="button" className="btn" onClick={reset}>Try again</button>
    </div>
  );
}
