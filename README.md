# BloodOath

Open-source e-signature with an agent that reads the contract before you swear the oath,
and a Bitcoin seal (OpenTimestamps) that proves the signed file never changed.

Built for Kiroween 2026 (Frankenstein category). Work in progress.

- Spec: [.kiro/specs/bloodoath](.kiro/specs/bloodoath)
- Kiro usage log: [docs/kiro-usage.md](docs/kiro-usage.md)
- Kiro credits per message: [docs/credits.md](docs/credits.md)

## Deploy to your AWS account

Everything (Amplify, Aurora Serverless, S3, SES, Bedrock access, cron) is one
CloudFormation stack:

```bash
GITHUB_TOKEN=<repo read token> MAIL_FROM=oath@your-domain.com ./infra/deploy.sh us-east-1
```

Then add the 3 DKIM CNAME records from the stack output to your mail domain.

Not legal advice.

## License

MIT
