# Runner

One CodeBuild run of Kiro CLI headless on one app repo:
clone from CodeCommit, start an empty repo from `templates/starter`, copy `steering/` into
`.kiro/steering/`, run `kiro-cli chat --v3 --no-interactive` with the mode prompt, run the
checks as scripts (`check.sh`: install, lint, synth, cfn-lint, guard), then push.

## Inputs (environment)

| Name | Required | Meaning |
|---|---|---|
| `MODE` | yes | `spec`, `build`, `change` or `repair` |
| `APP` | yes | app name, lowercase kebab-case (`fineprint`) |
| `REPO` | yes | CodeCommit repository name |
| `BRANCH` | yes | branch to push (`preview/3`, `revenant/fix-2`); never `main` |
| `BASE_BRANCH` | no | branch to start a new `BRANCH` from (default `main`) |
| `AWS_REGION` | yes | set by CodeBuild |
| `RV_PROJECT_ID` | yes | Revenant project id; every log line carries it |
| `RUN_ID` | no | Revenant run id (`runs.id`); default: the CodeBuild build id |
| `PROMPT_BUCKET`, `PROMPT_S3_KEY` | yes, except `build` | the request, change or repair context as plain text, under `runs/<app>/` |
| `ATTACH_S3_PREFIX` | no | attachments under `runs/<app>/`, copied to `.rv/attachments/` (not committed) |
| `KIRO_SECRET_ARN` | yes | Secrets Manager ARN of the Kiro key: the company key or `rv/kiro/<user>` |
| `KIRO_PAYER` | no | `company` or `own`, recorded on `credits` lines |
| `MODEL` | no | Kiro model id; default `auto` |
| `TIME_LIMIT_MIN` | no | whole run, default 45. The agent stops early enough to leave time for checks |
| `CREDITS_LIMIT` | no | Kiro credits per run; 0 or unset means no limit |
| `ATTEMPT` | no | repair attempt number (1 to 3) |
| `RV_AWS_APPLICATION`, `RV_AMPLIFY_APP_ID` | for synth | read by `blocks/tags.ts` and `check.sh` |

The agent and the checks run without AWS credentials and cannot push. Only the runner
itself reads the secret and the prompt and pushes.

## Branches

- Every new commit is pushed to `rv/run-<RUN_ID>` at once, so a stopped run keeps its commits.
  Amplify must not auto-build `rv/*`.
- After the checks pass, the runner pushes `BRANCH` and deletes `rv/run-<RUN_ID>`.
- When the remote repo is empty, the runner pushes the starter to `BASE_BRANCH` first.

## Exit codes

`0` pushed, `1` a step failed (kiro, a check, push), `2` bad input,
`3` time or credits limit reached (do not start a repair for this), `143` stopped.

## Log lines

The format is defined in `lib/contracts.ts` (`RUNNER_PREFIX`, `runnerLine`, `parseLine`); `log.ts`
writes it. One line per event: `rv: {"v":1,"t":"<type>","project","run","build","at",...}`.
`run` is `RUN_ID`, `build` is the CodeBuild build id (`runs.codebuild_id`), `at` grows by at
least 1 ms per line, strings are cut to 4000 characters.

| t | fields |
|---|---|
| `task_started` | `task` (`"3"`, `"3.1"`), `title` |
| `task_done` | `task`, `title`, `commit` |
| `file_changed` | `path` (repo-relative), `change`: `add`, `modify` or `delete` |
| `message` | `from`: `agent`, `runner` or `guard`; `text`; repair runs add `cause`; guard adds `rule`, `resource` |
| `error` | `step`: `input`, `secret`, `prompt`, `clone`, `seed`, `commit`, `kiro`, `spec`, `check`, `install`, `lint`, `synth`, `cfnlint`, `guard`, `push`, `limit`, `stopped`, `runner`; `text`; guard adds `rule`, `resource` |
| `credits` | `used` (session total), `limit`, `payer`, `model` |
| `run_done` | last line: `status`, `code` (exit code), `credits`, `commit`, `branch` (`BRANCH`, or `rv/run-<RUN_ID>` when work was saved), `seconds` |

## Guard

`check.sh` calls `tsx runner/guard.ts --cdk-out <dir> --repo . [--base origin/main]`, which
loads `lib/guard.ts` and fails closed when it is missing. `lib/guard.ts` exports
`check({ cdkOut, repo, base }) => { ok, findings: [{ rule, resource?, message }] }` and uses
only `node:` modules and relative imports.

## Image

`docker build --platform linux/arm64 -f runner/Dockerfile .` from the repository root.
