---
inclusion: always
---

# Product: BloodOath

BloodOath is an open-source e-signature app (a DocuSign alternative) with two extras
stitched on:

1. **An agent that reads the contract before you sign.** It splits the document into
   clauses, flags toxic clauses (one-sided termination, unlimited liability, auto-renewal
   traps, hidden fees, IP grabs, non-competes, forced arbitration), explains each in
   plain words, and proposes a fairer rewrite.
2. **A blockchain seal.** The SHA-256 hash of the final signed PDF is anchored to Bitcoin
   through OpenTimestamps. Anyone can later prove the file existed, unchanged, at that
   time. No wallet, no token, no fees for the user.

This repo also holds **Lazarus** (working name), the second half of the Frankenstein:
an open, self-hosted "Vercel for your own AWS account". An agent reads a repo, writes the
CloudFormation stack, deploys it, watches the build and the running app, and **fixes
failures by itself** (reads the logs, patches the code or the stack, redeploys). BloodOath
is Lazarus's first app (the PoC): Lazarus deploys BloodOath, and BloodOath is the proof.

Theme: Halloween is a **toggle**, like dark/light. Normal mode is a clean light/dark UI
that follows the system setting. Halloween mode: signing is "swearing a blood oath",
candle-lit, wax seals, blood-red ink; in Lazarus, failed deploys "die" and the agent
"resurrects" them. The spooky layer must make the real function clearer, never hide it.

## Hackathon

- Event: Kiroween 2026 (Devpost). Category: **Frankenstein**.
- Deadline: 2026-12-04 14:00 PT (2026-12-05 07:00 KST). No extensions.
- Bonus prizes targeted: Best Startup Project (McKinley Rice), Best Kiro Crew App,
  Best Demo, Bonus Blog Prize, Social Blitz.
- All code in this repo must be written on or after 2026-10-30. Do not import code from
  other McKinley Rice / Redrob repositories. Frameworks, libraries and starter templates
  are fine; anything else pre-existing must be declared in the submission.
- All submission material is in English.

## Users

- Primary: small business owners and freelancers who sign contracts without a lawyer
  (lease, supplier, freelance, NDA, employment offer).
- Secondary: anyone who sends a document for signature and wants tamper evidence.

## Non-negotiables

- The review is advice, not legal advice. Every review screen says so.
- A document is never sent to a third party except the LLM provider used for review.
- The signed PDF and its audit trail are downloadable and verifiable without BloodOath.
