# Host your own Revenant on AWS

The default install is **public**: the Revenant dashboard runs on Amplify Hosting with a
public URL and email sign-in. That is what the hosted demo uses.

Companies that want the dashboard reachable only inside their network can run it
**private** instead. The generated apps are not affected; each app still chooses public
or private on its own.

## Public (default)

```bash
./infra/deploy.sh us-east-1
```

| Part | Where |
|---|---|
| Dashboard | Amplify Hosting, public URL, email sign-in |
| Build runner | CodeBuild |
| Database | Aurora Serverless v2 in private subnets, Data API |

## Private

Amplify Hosting cannot run inside a VPC, so the private layout moves the dashboard to
containers behind an internal load balancer.

| Part | Where |
|---|---|
| Dashboard | ECS Fargate in private subnets, internal ALB |
| Name | Route 53 private hosted zone, for example `revenant.internal` |
| Way in | AWS Verified Access (company SSO, no VPN) or your existing Client VPN |
| Build runner | CodeBuild in the same VPC |
| Way out | NAT gateway (or your existing egress) for GitHub and the Kiro API |
| Database | Aurora Serverless v2 in private subnets |

Verified Access, Client VPN and NAT gateways have fixed monthly charges. Check the AWS
pricing pages for your region before choosing.

The private template is planned as `infra/install-private.yaml`.
