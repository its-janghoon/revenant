# Host your own Revenant on AWS

Revenant installs into your own AWS account. We recommend a dedicated AWS Organizations
member account, so Revenant and the apps it builds stay out of the rest of your console.

The default install is **public**: the Revenant dashboard runs on Amplify Hosting with a
public URL and Cognito sign-in. The judges' demo install uses the same layout. Companies
that want the dashboard reachable only inside their network can run it **private**
(documented below, not built for Kiroween).

## Public (default)

One template, `infra/install.yaml`, used two ways (see the README's Install section):
a CloudFormation quick-create link, or the same template from a one-line command in
AWS CloudShell.

The install asks for three things only:

| Parameter | Used for |
|---|---|
| Kiro API key | The company Kiro account, stored in Secrets Manager |
| Admin email | The first admin's Cognito invite and the Budgets alarm, for example `admin@example.com` |
| Monthly budget | An AWS Budgets alarm at that amount |

No GitHub token and no mail domain. The template creates IAM roles, the secrets, the
Budgets alarm and an Amplify app that builds Revenant from this public repository. The
first Amplify build deploys Revenant's Amplify Gen 2 backend (`amplify/backend.ts`).

| Part | Where |
|---|---|
| Dashboard | Next.js on Amplify Hosting (Amplify Gen 2), public URL |
| Sign-in | Amazon Cognito, email one-time code (no password), invite only |
| Revenant's own data | Aurora Serverless v2 Postgres (min 0 ACU) through the RDS Data API, Drizzle migrations |
| Timeline | Amplify Data (DynamoDB), append-only, realtime |
| Build runner | CodeBuild (ARM, medium) running Kiro CLI headless |
| Code | One CodeCommit repository per generated app |
| Generated apps | One Amplify Gen 2 app each, data in Amplify Data by default |
| Failure detection | EventBridge rules on Amplify, CloudFormation and CodeBuild failures |
| Console | One AppRegistry application per app, `awsApplication` tags, names `rv-<app>-<prod\|dev\|pv<n>>` |

When the install finishes, the stack output is the Revenant URL and the admin gets a
Cognito invite email from Cognito's own sender.

### Data for generated apps

- **Amplify Data (default).** Each Amplify branch gets its own backend, so every preview
  has its own tables, filled by a seed script. Nothing else is deployed for data.
- **SQL (opt-in).** The admin can allow Aurora Postgres for the whole install or for one
  user (`/admin/policy`, off by default). Such an app gets a dev and a prod database, and
  each preview gets its own database copied from dev. The runner reaches dev and preview
  databases only; only Publish writes to prod, after a snapshot.

Neither path uses a public database, a VPC Lambda or a NAT gateway.

### Who pays for Kiro

The admin picks one in `/admin/policy`:

| Mode | Runs use |
|---|---|
| Company key | The Kiro API key given at install |
| Bring your own Kiro | Each user's own Kiro key, connected in Settings |
| Both | The user's own key if connected, else the company key |

A user's own key is stored in Secrets Manager under that user (`rv/kiro/<user_id>`),
used only for that user's runs, and removable by the user at any time. Each run records
the Kiro credits it used and whose Kiro paid.

### Uninstall

Delete the Revenant stacks. Every generated app keeps running: each one is a separate
Amplify app with its own repository and data.

## Private (not built for Kiroween)

Amplify Hosting cannot run inside a VPC, so the private layout moves the dashboard to
containers behind an internal load balancer. Generated apps are not affected; each app
still chooses public or private on its own.

| Part | Where |
|---|---|
| Dashboard | ECS Fargate in private subnets, internal ALB |
| Name | Route 53 private hosted zone, for example `revenant.internal` |
| Way in | AWS Verified Access (company SSO, no VPN) or your existing Client VPN |
| Sign-in | Cognito email code, same as public |
| Build runner | CodeBuild in the same VPC |
| Way out | NAT gateway (or your existing egress) for the Kiro API; CodeCommit and AWS APIs can use VPC endpoints |
| Revenant's own data | Aurora Serverless v2 in private subnets |

Verified Access, Client VPN and NAT gateways have fixed monthly charges. Check the AWS
pricing pages for your region before choosing.

The private template is planned as `infra/install-private.yaml`.
