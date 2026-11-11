# Revenant

An open "Vercel for your own AWS account". Revenant's agent writes the CloudFormation
stack for your repo, deploys it into your AWS account, and when a deploy dies, it reads
the logs, fixes the code or the stack, and brings it back.

Built for Kiroween 2026 (Frankenstein category). Work in progress.

## First app: BloodOath

Open-source e-signature with an agent that reads the contract for toxic clauses before
you swear the oath, and a Bitcoin seal (OpenTimestamps) that proves the signed file never
changed. Revenant deploys BloodOath; BloodOath is the proof that Revenant works.
Not legal advice.

- Specs: [.kiro/specs/revenant](.kiro/specs/revenant), [.kiro/specs/bloodoath](.kiro/specs/bloodoath)
- Kiro usage log: [docs/kiro-usage.md](docs/kiro-usage.md)
- Kiro credits per message: [docs/credits.md](docs/credits.md)

## Deploy BloodOath to your AWS account

Everything (Amplify, Aurora Serverless, S3, SES, Bedrock access, cron) is one
CloudFormation stack:

```bash
GITHUB_TOKEN=<repo read token> MAIL_FROM=oath@your-domain.com ./infra/deploy.sh us-east-1
```

Then add the 3 DKIM CNAME records from the stack output to your mail domain.

## License

MIT
