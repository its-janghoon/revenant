# Building blocks

Tested pieces a generated app adds to its backend from `amplify/backend.ts`. Revenant copies
this folder into every new app as `blocks/`. The agent uses only these, plus what Amplify
Gen 2 itself provides (`defineAuth`, `defineData`, `defineFunction`, `defineStorage`).

| Block | Call | Adds |
|---|---|---|
| `tags` | `tags(backend)`, always last | `awsApplication`, `revenant:app`, `revenant:env`, `revenant:name`, `revenant:project` on every resource |
| `name` | `name(scope, part?)` | names `rv-<app>-<prod\|dev\|pv<n>>` |
| `files` | `files.define()` in `amplify/storage/resource.ts`, then `files(backend)` | private S3 bucket per user folder, presigned upload and download, retained, versioned |
| `mail` | `mail(backend, { from, senders })` | SES sender identity; senders may send only as `from` |
| `ai` | `ai(backend, { models, functions })` | Bedrock invoke on the listed models only, for the functions and the server |
| `cron` | `cron(backend.fn, { id, schedule })` | EventBridge rule that runs a function |
| `data` | | Amplify Data models and a seed script (default) |
| `db` | | Aurora Serverless v2 with the Data API, only when the admin allows SQL |

Environment set on the Amplify app by Revenant: `RV_APP`, `RV_PROJECT_ID`,
`RV_AWS_APPLICATION` (AppRegistry application ARN), `RV_COMPUTE_ROLE_ARN` (optional).
