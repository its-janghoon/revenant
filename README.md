# Revenant

**Logo: Pulse.** A flat line that beats once, drawn on a rounded square: dark ink in Light,
blood red `#b3121c` in Haunted. It is the same heartbeat Revenant draws for every app:
beating while live, flat when a deploy dies, beating again when it is fixed.
See option A in [design/mockups/logos.html](design/mockups/logos.html).

Lovable on your own AWS account. Say what you want, a Kiro agent writes the spec, builds
the app on Amplify Gen 2, and deploys it into your AWS account, paid with your AWS
credits. When a build or deploy dies, the agent reads the logs, fixes it, and brings it back.

Built for Kiroween 2026 (Frankenstein category). Open source, MIT. Work in progress.

## Why

Companies that want everything on AWS pay per seat for hosted builders, and hand those
vendors their code, data and infrastructure. Revenant gives them the same build-and-ship
experience inside their own account.

- **You own everything.** Code in CodeCommit, one Amplify Gen 2 app per app, data in your
  account. Uninstalling Revenant leaves every app running.
- **No seats.** You pay your own AWS bill, and spend your AWS credits if you have them.
  Every screen shows credits left and what each app costs.
- **Spec first.** Kiro writes requirements, design and tasks before any code. You edit the
  spec, and nothing is built until you press "Build it".
- **Fixes itself.** Failed builds and deploys are repaired by the agent, with the cause,
  the fix and the time to recover on record.

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

### Publishing the template (maintainers)

The one-click link only works with a template in S3. After each release on `main`, upload
`infra/install.yaml` to an S3 bucket you own (here `BUCKET`, any region) and point the link at it:

```
aws s3api put-public-access-block --bucket BUCKET --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket BUCKET --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::BUCKET/install.yaml"}]}'
aws s3 cp infra/install.yaml s3://BUCKET/install.yaml --content-type text/yaml --cache-control no-cache
aws cloudformation validate-template --template-url https://BUCKET.s3.amazonaws.com/install.yaml
```

Only `install.yaml` is public; keep everything else in the bucket private. The link is
`https://console.aws.amazon.com/cloudformation/home#/stacks/quickcreate?stackName=revenant&templateURL=https://BUCKET.s3.amazonaws.com/install.yaml`;
the link above is a placeholder until the bucket exists.

- Spec: [.kiro/specs/revenant](.kiro/specs/revenant)
- Mockups: [design/mockups](design/mockups) (open `flow.html` for every screen, `live.html` for the theme)
- Host your own, public or private: [docs/self-host.md](docs/self-host.md)
- Hosting for outside customers: [docs/platforms.md](docs/platforms.md)
- How we used Kiro: [docs/kiro-usage.md](docs/kiro-usage.md)
- Kiro credits per turn: [docs/credits.md](docs/credits.md)
- Demo video storyboard: [docs/storyboard.md](docs/storyboard.md)


## How it works

1. **Sign in** with an email code (Amazon Cognito, no password, invite only).
2. **Ask** in plain words. Revenant creates a CodeCommit repo for the project.
3. **Spec.** Kiro writes `.kiro/specs/<app>/` with the AWS parts and the estimated monthly cost.
4. **Build.** Kiro CLI runs headless in CodeBuild, one commit per task, and the push starts
   an Amplify preview with its own URL and its own data.
5. **Edit** like Lovable or v0: chat, **Select** an element in the preview to see its file
   and line, or edit and commit in the **Code** tab.
6. **Publish** merges to `main` and deploys production. A replace or delete waits for your approval.
7. **Repair.** When a run, build, deploy or health check fails, a repair run fixes it on
   `revenant/fix-<n>`, checks it, merges and redeploys (up to 3 tries).

## Data

- **Amplify Data by default.** Every preview branch has its own tables with seeded sample data.
- **SQL when the admin allows it.** Aurora Serverless v2 Postgres with dev, prod and a
  database per preview; Publish shows the migration and snapshots prod first.
- No public database, no VPC Lambda, no NAT gateway.

## Admin

`/admin` sets the rules for the install: SQL on or off (for everyone or per user), the Kiro
model (Auto by default), who pays for Kiro (company key, **bring your own Kiro**, or both),
the monthly budget and an auto-delete period. Every change goes to the audit log.

## Light and Haunted

One switch in the header. **Light** is plain with no effects. **Haunted** is dark: deploys
die under a tombstone, repairs are rituals, live apps have risen, with a flashlight, rain
and thunder made in the browser. **Calm** keeps the dark look and turns every effect off.
The theme never changes behaviour.

## Demo

Request: "Build me a contract signing site where an AI flags toxic clauses before you sign."
The result is **FinePrint** (subtitled "Blood Oath" in Haunted).

## Docs

## License

MIT
