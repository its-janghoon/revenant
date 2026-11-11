# Revenant

Lovable on your own AWS account. Say what you want, a Kiro agent writes the spec,
builds the app, and deploys it into your AWS account, paid with your AWS credits.
When a build or deploy dies, the agent reads the logs, fixes it, and brings it back.

Built for Kiroween 2026 (Frankenstein category). Work in progress.

- You own everything: code in your GitHub, one CloudFormation stack per app.
- Paid by your AWS credits, with cost per app on screen.
- Spec first: requirements, design and tasks before any code.
- Fixes itself: failed builds and deploys are repaired with the cause on record.

Demo request: "Build me a contract signing site where an AI flags toxic clauses before you sign."

- Spec: [.kiro/specs/revenant](.kiro/specs/revenant)
- Mockups: [design/mockups](design/mockups) (open `live.html`, toggle Halloween)
- Host your own on AWS: [docs/self-host.md](docs/self-host.md)
- Kiro usage log: [docs/kiro-usage.md](docs/kiro-usage.md)
- Kiro credits per message: [docs/credits.md](docs/credits.md)

## License

MIT
