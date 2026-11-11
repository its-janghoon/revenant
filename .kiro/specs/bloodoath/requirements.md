# Requirements: BloodOath

## Introduction

BloodOath lets a person upload a contract, get an agentic review of toxic clauses,
send it for signature, sign it, and seal the final PDF on Bitcoin. A Kiro Crew app
brings the same review and sealing into Kiro Crew. The demo video is produced with Kiro.

## Requirement 1: Upload a document

**User story:** As a sender, I want to upload a PDF, so that I can review and send it.

1. WHEN a user uploads a PDF up to 20 MB THEN the system SHALL store it and show page previews.
2. IF the file is not a valid PDF or is larger than 20 MB THEN the system SHALL reject it with a plain error.
3. WHEN a PDF is stored THEN the system SHALL record its SHA-256 hash as the original hash.
4. IF the PDF has no extractable text THEN the system SHALL say review is unavailable and still allow signing.

## Requirement 2: Toxic clause review

**User story:** As a signer without a lawyer, I want the contract read for me, so that I know what I am agreeing to.

1. WHEN a user starts a review THEN the system SHALL split the text into numbered clauses with page references.
2. WHEN clauses are split THEN the review agent SHALL rate each clause `safe`, `watch` or `toxic`.
3. WHEN a clause is `watch` or `toxic` THEN the system SHALL show the reason in plain words, the risk category, and a fairer rewrite.
4. WHEN a review finishes THEN the system SHALL show a summary: counts per rating and the top 3 risks.
5. WHEN the user selects a flagged clause THEN the system SHALL highlight its exact text on the page preview.
6. The review agent SHALL quote only text present in the document; IF a quote does not match the source text THEN the system SHALL drop that finding.
7. The system SHALL show "This is not legal advice" on every review screen.
8. WHILE a review runs THE system SHALL stream clause results as they finish.
9. WHERE the user picks a perspective (signer or sender) THE review agent SHALL judge risk from that side.

Risk categories: termination, liability, auto-renewal, payment and fees, IP and confidentiality, non-compete, dispute resolution, data and privacy, other.

## Requirement 3: Send for signature

**User story:** As a sender, I want to place signature fields and invite signers, so that everyone signs one document.

1. WHEN a sender places fields (signature, initials, date, text) on pages THEN the system SHALL save their positions per signer.
2. WHEN a sender sends the document THEN the system SHALL email each signer a single-use link that expires in 14 days.
3. WHERE signing order is set THE system SHALL invite the next signer only after the previous one signs.
4. WHEN the document is sent THEN the system SHALL lock its content; the original hash SHALL NOT change.

## Requirement 4: Sign ("swear the oath")

**User story:** As a signer, I want to see the review and sign in one place, so that I sign with open eyes.

1. WHEN a signer opens the link THEN the system SHALL show the document and the review summary before the sign step.
2. WHEN a signer draws, types or uploads a signature THEN the system SHALL render it in blood-red ink.
3. BEFORE the final sign THE system SHALL show a confirm step that names the document, the signer and the toxic clause count.
4. WHEN a signer declines THEN the system SHALL record the reason and notify the sender.
5. WHEN a signer signs THEN the system SHALL record time, IP address, user agent and email in the audit trail.

## Requirement 5: Blockchain seal

**User story:** As any party, I want tamper evidence that does not depend on BloodOath, so that the contract can be trusted later.

1. WHEN all signers have signed THEN the system SHALL produce the final PDF with signatures and an audit certificate page.
2. WHEN the final PDF exists THEN the system SHALL compute its SHA-256 hash and submit it to OpenTimestamps calendars.
3. WHEN calendars accept the hash THEN the system SHALL store the pending `.ots` proof and mark the document `sealing`.
4. WHEN the Bitcoin attestation is available THEN the system SHALL upgrade the proof and mark the document `sealed` with the block height.
5. WHEN a document is sealed THEN the system SHALL email all parties the final PDF and the `.ots` file.
6. The system SHALL NOT require a wallet, a token or any payment from the user for sealing.

## Requirement 6: Verify

**User story:** As anyone holding a PDF, I want to check it, so that I know it was not changed.

1. WHEN a user drops a PDF (and optionally an `.ots` file) on `/verify` THEN the system SHALL hash it in the browser and show whether it matches a sealed document.
2. WHEN it matches THEN the system SHALL show signers, sign times and the Bitcoin block height and time.
3. IF it does not match THEN the system SHALL say the file differs from any sealed version.
4. The verify page SHALL work without an account and SHALL NOT upload the file.
5. The README SHALL explain how to verify with the `ots` command-line tool, without BloodOath.

## Requirement 7: Kiro Crew app

**User story:** As a Kiro Crew user, I want BloodOath inside my crew, so that my agents can review and seal documents for me.

1. The repository SHALL contain a Kiro Crew app in `crew-app/` that installs with `kirocrew app install`.
2. The app SHALL provide an MCP server with tools: `review_contract`, `send_for_signature`, `document_status`, `verify_document`.
3. The app SHALL provide an agent ("Notary") and a skill that explains when and how to use those tools.
4. The app SHALL provide a dashboard page listing documents with status (draft, out for signature, sealing, sealed).
5. The app SHALL provide a cron that upgrades pending OpenTimestamps proofs and reminds unsigned signers every 3 days.
6. WHEN a user asks the crew "review this contract" with a PDF path THEN the Notary agent SHALL return the review summary in chat.

## Requirement 8: Spooky design

**User story:** As a judge, I want a polished, memorable product, so that it feels like a real app.

1. The UI SHALL have a Halloween toggle next to the light/dark toggle, in the header, on every page.
2. WHEN Halloween mode is off THEN the UI SHALL be a clean light or dark theme that follows the system setting until the user picks one.
3. WHEN Halloween mode is on THEN the UI SHALL use a candle-lit theme, a wax seal for sealed status, blood-red signature ink and oath wording.
4. The system SHALL remember both choices per browser and SHALL render the saved theme on first paint with no flash.
5. Halloween mode SHALL change only looks and wording, never behaviour or data.
6. Animations (candle flicker, ink flow, seal press) SHALL respect `prefers-reduced-motion`.
7. Text contrast SHALL meet WCAG AA in all four themes (light, dark, Halloween light, Halloween dark).
8. Core flows SHALL work on mobile width (375 px).

## Requirement 9: Demo video made with Kiro

**User story:** As the team, we want the demo video produced by Kiro, so that the video itself shows Kiro use.

1. The repository SHALL contain a storyboard in `video/storyboard.md`, approved by Janghoon before any rendering.
2. Kiro SHALL record the real app flows with Playwright and compose them with Remotion in `video/`.
3. The final video SHALL be under 3 minutes and show: problem, upload, review, sign, seal, verify, Kiro Crew app.
4. The video SHALL contain no third-party trademarks or copyrighted music without permission.

## Requirement 10: Submission

1. The repository SHALL be public on GitHub with an OSI license shown in the About section.
2. `/.kiro` SHALL be committed and SHALL NOT be listed in `.gitignore`.
3. `docs/kiro-usage.md` SHALL log Kiro IDE, CLI and Kiro Crew use, including subagents, crons, monitors, hooks, steering, specs and MCP.
4. The live app SHALL have a judge account whose credentials go only in the private Devpost field.
