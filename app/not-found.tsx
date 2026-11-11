import Link from "next/link";
import "@/components/ui.css";

export default function NotFound() {
  return (
    <div className="center">
      <div className="card" style={{ maxWidth: 380, textAlign: "center" }}>
        <h1 className="h" style={{ fontSize: 22, marginBottom: 6 }}>
          <span className="rv-l">Not found</span><span className="rv-h">Nothing rests here</span>
        </h1>
        <div className="muted" style={{ marginBottom: 14 }}>This page or app does not exist, or it is not yours.</div>
        <Link href="/" className="btn">Home</Link>
      </div>
    </div>
  );
}
