# Tasks: BloodOath

- [ ] 1. Project setup
  - [ ] 1.1 Next.js + TypeScript app, Drizzle (`aws-data-api`), S3 presigned URLs, env schema, `db:migrate` script
  - [ ] 1.2 Deploy `infra/stack.yaml` with `infra/deploy.sh`, SES DKIM records, SES production access
  - [ ] 1.3 Theme tokens, fonts, reduced-motion helper
  - [ ] 1.4 Auth (email magic link) and a seeded judge account
  - _Requirements: 8, 10.4_

- [ ] 2. Upload and preview
  - [ ] 2.1 Upload route with size and type checks, original hash
  - [ ] 2.2 Page preview with `pdfjs-dist`
  - _Requirements: 1_

- [ ] 3. Review agent
  - [ ] 3.1 Text extraction with page positions
  - [ ] 3.2 Deterministic splitter + model fix-up
  - [ ] 3.3 Rubric data and rating call with zod schema
  - [ ] 3.4 Quote check and summary
  - [ ] 3.5 Streaming route and review UI with highlight on the page
  - [ ] 3.6 Property tests: splitter round-trip, quote check
  - _Requirements: 2_

- [ ] 4. Fields and sending
  - [ ] 4.1 Field placement editor
  - [ ] 4.2 Signers, order, single-use hashed tokens, SES email
  - [ ] 4.3 Property test: used or expired tokens never open
  - _Requirements: 3_

- [ ] 5. Signing
  - [ ] 5.1 Sign page with review summary first
  - [ ] 5.2 Draw / type / upload signature in blood-red ink
  - [ ] 5.3 Confirm step, decline flow, audit events
  - _Requirements: 4_

- [ ] 6. Final PDF and seal
  - [ ] 6.1 Stamp fields and audit certificate page with `pdf-lib`
  - [ ] 6.2 OpenTimestamps stamp and upgrade, seal cron
  - [ ] 6.3 Sealed email with PDF and `.ots`
  - [ ] 6.4 Property test: anchored hash equals downloaded bytes hash
  - _Requirements: 5_

- [ ] 7. Verify page
  - [ ] 7.1 Browser-side hashing, lookup, result view
  - [ ] 7.2 README section: verify with the `ots` CLI
  - _Requirements: 6_

- [ ] 8. Kiro Crew app
  - [ ] 8.1 Scaffold with `kirocrew app init`, read the App Kit docs
  - [ ] 8.2 API keys in BloodOath settings
  - [ ] 8.3 MCP server with the 4 tools
  - [ ] 8.4 Notary agent and skill
  - [ ] 8.5 Dashboard page and crons
  - _Requirements: 7_

- [ ] 9. Spooky polish
  - [ ] 9.1 Landing with candle scene
  - [ ] 9.2 Ink and seal animations
  - [ ] 9.3 Contrast and 375 px pass
  - _Requirements: 8_

- [ ] 10. Demo video
  - [ ] 10.1 Storyboard for Janghoon's approval
  - [ ] 10.2 Playwright scene recordings
  - [ ] 10.3 Remotion composition, under 3 minutes
  - _Requirements: 9_

- [ ] 11. Submission
  - [ ] 11.1 Public GitHub repo, license in About, `.kiro` committed
  - [ ] 11.2 `docs/kiro-usage.md` write-up
  - [ ] 11.3 Blog post and #KiroweenHackathon26 post
  - [ ] 11.4 Devpost form: category, bonus prizes, judge credentials
  - _Requirements: 10_
