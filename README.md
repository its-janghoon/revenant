# Revenant

Lovable on your own AWS account. Say what you want, a Kiro agent writes the spec,
builds the app, and deploys it into your AWS account, paid with your AWS credits.
When a build or deploy dies, the agent reads the logs, fixes it, and brings it back.

Built for Kiroween 2026 (Frankenstein category). Work in progress.

- You own everything: code in CodeCommit, one Amplify Gen 2 app per app, data in Aurora Postgres. Nothing leaves AWS.
- Paid by your AWS credits, with cost per app on screen.
- Spec first: requirements, design and tasks before any code.
- Fixes itself: failed builds and deploys are repaired with the cause on record.

Demo request: "Build me a contract signing site where an AI flags toxic clauses before you sign."

## Install

Both ways deploy the same template, [infra/install.yaml](infra/install.yaml). It asks for a Kiro API key,
an admin email and a monthly budget. We recommend a dedicated AWS Organizations member account.

1. One click: [Launch the install stack](https://console.aws.amazon.com/cloudformation/home#/stacks/quickcreate?stackName=revenant&templateURL=https://its-janghoon-revenant.s3.amazonaws.com/install.yaml)
   (needs the template published to that URL; until then use way 2).
2. AWS CloudShell, one line:

```
curl -fsSLo install.yaml https://raw.githubusercontent.com/its-janghoon/revenant/main/infra/install.yaml && aws cloudformation deploy --template-file install.yaml --stack-name revenant --capabilities CAPABILITY_NAMED_IAM --parameter-overrides KiroApiKey=YOUR_KIRO_KEY AdminEmail=you@example.com Budget=100
```

The stack copies this repository into CodeCommit in your account, bootstraps CDK, and starts
the first Amplify build (about 15 minutes). The `RevenantUrl` output is your Revenant; the admin
gets a Cognito invite email. To update later, run the `UpdateCommand` output.

- Spec: [.kiro/specs/revenant](.kiro/specs/revenant)
- Mockups: [design/mockups](design/mockups) (open `live.html`, toggle Halloween)
- Host your own on AWS: [docs/self-host.md](docs/self-host.md)
- Kiro usage log: [docs/kiro-usage.md](docs/kiro-usage.md)
- Kiro credits per message: [docs/credits.md](docs/credits.md)

## License

MIT
