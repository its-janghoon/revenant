"use client";
// Sign-in (flow2.js S.signin): Cognito email one-time code, or a passkey. Invite only.
import { confirmSignIn, getCurrentUser, signIn, type SignInOutput } from "aws-amplify/auth";
import { ArrowLeft, KeyRound, Loader, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PulseMark } from "@/lib/theme";
import { W } from "./words";

type Stage = "email" | "code" | "password";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<Stage>("email");
  const [busy, setBusy] = useState<"" | "code" | "passkey" | "confirm">("");
  const [err, setErr] = useState("");

  useEffect(() => {
    getCurrentUser().then(() => window.location.replace(next())).catch(() => undefined);
  }, []);

  const next = () => {
    const n = new URLSearchParams(window.location.search).get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
  };

  async function step(r: SignInOutput): Promise<void> {
    const s = r.nextStep.signInStep;
    if (r.isSignedIn || s === "DONE") {
      window.location.replace(next());
      return;
    }
    if (s === "CONTINUE_SIGN_IN_WITH_FIRST_FACTOR_SELECTION") return step(await confirmSignIn({ challengeResponse: "EMAIL_OTP" }));
    if (s === "CONFIRM_SIGN_IN_WITH_EMAIL_CODE") { setStage("code"); return; }
    if (s === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") { setStage("password"); return; }
    throw new Error(`This account needs a sign-in step Revenant does not support yet (${s}). Ask your admin.`);
  }

  const fail = (e: unknown) => {
    const n = (e as Error).name;
    const m = (e as Error).message ?? "";
    setErr(
      n === "NotAuthorizedException" && /session/i.test(m) ? "This sign-in timed out (15 minutes). Send a new code."
        : n === "UserNotFoundException" || n === "NotAuthorizedException" ? "No invite for this email. Revenant is invite only: ask your admin."
        : n === "CodeMismatchException" ? "That code is wrong. Check the latest email."
        : n === "ExpiredCodeException" ? "That code expired. Send a new one."
        : n === "NotAllowedError" ? "The passkey prompt was closed."
        : (e as Error).message || "Sign-in failed",
    );
  };

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!email.includes("@")) { setErr("Enter your work email"); return; }
    setErr(""); setBusy("code");
    try {
      await step(await signIn({ username: email.trim(), options: { authFlowType: "USER_AUTH", preferredChallenge: "EMAIL_OTP" } }));
    } catch (x) { fail(x); } finally { setBusy(""); }
  }

  async function passkey() {
    if (!email.includes("@")) { setErr("Enter your work email first, then use your passkey"); return; }
    setErr(""); setBusy("passkey");
    try {
      await step(await signIn({ username: email.trim(), options: { authFlowType: "USER_AUTH", preferredChallenge: "WEB_AUTHN" } }));
    } catch (x) { fail(x); } finally { setBusy(""); }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setErr(""); setBusy("confirm");
    try {
      await step(await confirmSignIn({ challengeResponse: stage === "code" ? code.trim() : password }));
    } catch (x) { fail(x); } finally { setBusy(""); }
  }

  return (
    <div className="center">
      <div style={{ width: 380, maxWidth: "100%" }}>
        <div className="rv-logo" style={{ justifyContent: "center", marginBottom: 26, fontSize: 20 }}>
          <span className="rv-mark"><PulseMark size={15} color="#fff" /></span>Revenant
        </div>
        <div className="card" style={{ padding: 26 }}>
          <h1 className="h" style={{ fontSize: 22, marginBottom: 4 }}><W k="signin" /></h1>
          {stage === "email" ? (
            <form onSubmit={sendCode}>
              <div className="muted" style={{ marginBottom: 18 }}><W k="signinSub" /></div>
              <label className="label" htmlFor="email" style={{ marginBottom: 6 }}>Work email</label>
              <input id="email" className="input" type="email" autoComplete="username webauthn" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 14 }} autoFocus />
              <button className="btn wide" type="submit" disabled={busy !== ""}>
                {busy === "code" ? <Loader size={15} className="spin" aria-hidden /> : <Mail size={15} aria-hidden />} <W k="sendCode" />
              </button>
              <div className="or"><span />or<span /></div>
              <button className="ghost wide" type="button" onClick={passkey} disabled={busy !== ""}>
                {busy === "passkey" ? <Loader size={15} className="spin" aria-hidden /> : <KeyRound size={15} aria-hidden />} Use a passkey
              </button>
            </form>
          ) : (
            <form onSubmit={confirm}>
              <div className="muted" style={{ marginBottom: 18 }}>
                {stage === "code" ? <>We sent an 8-digit code to <b>{email}</b>.</> : "Your invite came with a temporary password. Choose a new one; after this you sign in with a code."}
              </div>
              {stage === "code" ? (
                <>
                  <label className="label" htmlFor="code" style={{ marginBottom: 6 }}>Code</label>
                  <input id="code" className="input otp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ marginBottom: 14 }} autoFocus />
                </>
              ) : (
                <>
                  <label className="label" htmlFor="pw" style={{ marginBottom: 6 }}>New password</label>
                  <input id="pw" className="input" type="password" autoComplete="new-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 14 }} autoFocus />
                </>
              )}
              <button className="btn wide" type="submit" disabled={busy !== "" || (stage === "code" ? code.length < 6 : password.length < 8)}>
                {busy === "confirm" ? <Loader size={15} className="spin" aria-hidden /> : null} Sign in
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                <button type="button" className="link muted" onClick={() => { setStage("email"); setCode(""); setErr(""); }}>
                  <ArrowLeft size={12} aria-hidden /> Other email
                </button>
                {stage === "code" ? <button type="button" className="link muted" onClick={() => sendCode()}>Send a new code</button> : null}
              </div>
            </form>
          )}
          {err ? <div className="err" role="alert">{err}</div> : null}
          <div className="muted" style={{ marginTop: 14, fontSize: 11.5, textAlign: "center" }}>Amazon Cognito · invite only</div>
        </div>
      </div>
    </div>
  );
}
