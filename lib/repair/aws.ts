// AWS side of the repair loop: log gathering, Amplify settings, starting repair runs,
// and timeline writes through the timeline function.
import {
  AmplifyClient, GetAppCommand, GetBranchCommand, GetJobCommand, ListBranchesCommand, ListJobsCommand, UpdateBranchCommand,
} from "@aws-sdk/client-amplify";
import { CloudFormationClient, DescribeStackEventsCommand } from "@aws-sdk/client-cloudformation";
import { CloudWatchLogsClient, GetLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { BatchGetBuildsCommand, CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
import { CodeCommitClient, GetBranchCommand as GetRepoBranchCommand, GetCommitCommand, GetDifferencesCommand } from "@aws-sdk/client-codecommit";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { roleName } from "../../runner/role";
import type { TimelineEvent } from "../contracts";
import { redact } from "./logs";
import type { Aws, Timeline } from "./ports";

export interface AwsConfig {
  region: string;
  account: string;
  partition?: string;
  runnerProject: string;
  promptBucket: string;
  timeLimitMin?: number; // per repair run, default 30
}

const named = (e: unknown, name: string) => (e as { name?: string } | null)?.name === name;
const vars = (list: { name?: string; value?: string }[] | undefined) =>
  Object.fromEntries((list ?? []).filter((v) => v.name).map((v) => [v.name!, v.value ?? ""]));

export function awsPort(c: AwsConfig): Aws {
  const region = c.region;
  const amplify = new AmplifyClient({ region });
  const cfn = new CloudFormationClient({ region });
  const logs = new CloudWatchLogsClient({ region });
  const codebuild = new CodeBuildClient({ region });
  const codecommit = new CodeCommitClient({ region });
  const s3 = new S3Client({ region });
  const ssm = new SSMClient({ region });

  return {
    async job(appId, branchName, jobId) {
      const { job } = await amplify.send(new GetJobCommand({ appId, branchName, jobId }));
      const steps = job?.steps ?? [];
      const failed = steps.filter((s) => s.status === "FAILED");
      const texts: string[] = [];
      for (const s of failed.length ? failed : steps.slice(-1)) {
        if (!s.logUrl) continue;
        const r = await fetch(s.logUrl); // presigned S3 URL, short lived
        texts.push(`--- ${s.stepName} ---\n${await r.text()}`);
      }
      return { log: redact(texts.join("\n")), commit: job?.summary?.commitId ?? null };
    },
    async latestJob(appId, branchName) {
      const { jobSummaries } = await amplify.send(new ListJobsCommand({ appId, branchName, maxResults: 1 }));
      const j = jobSummaries?.[0];
      return j?.jobId ? { jobId: j.jobId, status: j.status ?? "" } : null;
    },
    async branches(appId) {
      const out: string[] = [];
      let nextToken: string | undefined;
      do {
        const r = await amplify.send(new ListBranchesCommand({ appId, nextToken, maxResults: 50 }));
        out.push(...(r.branches ?? []).map((b) => b.branchName ?? "").filter(Boolean));
        nextToken = r.nextToken;
      } while (nextToken);
      return out;
    },
    async stackErrors(StackName) {
      const { StackEvents } = await cfn.send(new DescribeStackEventsCommand({ StackName }));
      return redact(
        (StackEvents ?? [])
          .filter((e) => e.ResourceStatus?.endsWith("_FAILED"))
          .slice(0, 20)
          .map((e) => `${e.LogicalResourceId} (${e.ResourceType}) ${e.ResourceStatus}: ${e.ResourceStatusReason ?? ""}`)
          .join("\n"),
      );
    },
    async build(id) {
      const { builds } = await codebuild.send(new BatchGetBuildsCommand({ ids: [id] }));
      const b = builds?.[0];
      if (!b) return null;
      const env = vars(b.environment?.environmentVariables);
      const log: string[] = [];
      if (b.logs?.groupName && b.logs.streamName) {
        const r = await logs.send(
          new GetLogEventsCommand({ logGroupName: b.logs.groupName, logStreamName: b.logs.streamName, startFromHead: false, limit: 2000 }),
        );
        for (const e of r.events ?? []) if (e.message) log.push(e.message);
      }
      return { env, log };
    },
    async changed(repositoryName, commitId) {
      const { commit } = await codecommit.send(new GetCommitCommand({ repositoryName, commitId }));
      const parent = commit?.parents?.[0];
      const r = await codecommit.send(
        new GetDifferencesCommand({ repositoryName, afterCommitSpecifier: commitId, ...(parent ? { beforeCommitSpecifier: parent } : {}), MaxResults: 100 }),
      );
      return (r.differences ?? []).map((x) => x.afterBlob?.path ?? x.beforeBlob?.path ?? "").filter(Boolean);
    },
    async branchExists(repositoryName, branchName) {
      try {
        await codecommit.send(new GetRepoBranchCommand({ repositoryName, branchName }));
        return true;
      } catch (e) {
        if (named(e, "BranchDoesNotExistException")) return false;
        throw e;
      }
    },
    async appEnv(appId) {
      const { app } = await amplify.send(new GetAppCommand({ appId }));
      return app?.environmentVariables ?? {};
    },
    async branchEnv(appId, branchName) {
      try {
        const { branch } = await amplify.send(new GetBranchCommand({ appId, branchName }));
        return branch?.environmentVariables ?? {};
      } catch (e) {
        if (named(e, "NotFoundException")) return null;
        throw e;
      }
    },
    async setBranchEnv(appId, branchName, environmentVariables) {
      await amplify.send(new UpdateBranchCommand({ appId, branchName, environmentVariables }));
    },
    async param(Name) {
      try {
        const r = await ssm.send(new GetParameterCommand({ Name, WithDecryption: true }));
        return r.Parameter?.Value ?? null;
      } catch (e) {
        if (named(e, "ParameterNotFound")) return null;
        throw e;
      }
    },
    async putParam(Name, Value) {
      await ssm.send(new PutParameterCommand({ Name, Value, Type: "SecureString", Overwrite: true }));
    },
    async startRun(i) {
      const key = `runs/${i.app}/repair-${i.runId}.txt`;
      await s3.send(new PutObjectCommand({ Bucket: c.promptBucket, Key: key, Body: i.prompt, ContentType: "text/plain; charset=utf-8" }));
      const limit = c.timeLimitMin ?? 30;
      const env: Record<string, string> = {
        MODE: "repair", APP: i.app, REPO: i.repo, BRANCH: i.branch, BASE_BRANCH: i.base, RUN_ID: i.runId,
        ATTEMPT: String(i.attempt), PROMPT_BUCKET: c.promptBucket, PROMPT_S3_KEY: key,
        KIRO_SECRET_ARN: i.kiroSecret, KIRO_PAYER: i.payer, MODEL: i.model,
        TIME_LIMIT_MIN: String(limit), CREDITS_LIMIT: String(i.creditsLimit), ...i.env,
      };
      const r = await codebuild.send(
        new StartBuildCommand({
          projectName: c.runnerProject,
          serviceRoleOverride: `arn:${c.partition ?? "aws"}:iam::${c.account}:role/${roleName(i.app)}`,
          timeoutInMinutesOverride: limit + 5,
          environmentVariablesOverride: Object.entries(env).map(([name, value]) => ({ name, value, type: "PLAINTEXT" })),
        }),
      );
      if (!r.build?.id) throw new Error("StartBuild returned no build id");
      return r.build.id;
    },
  };
}

/** Writes through the timeline function's `{ events }` input (amplify/functions/timeline). */
export function lambdaTimeline(region: string, functionName: string): Timeline {
  const lambda = new LambdaClient({ region });
  return {
    async write(events: TimelineEvent[]) {
      const r = await lambda.send(new InvokeCommand({ FunctionName: functionName, Payload: new TextEncoder().encode(JSON.stringify({ events })) }));
      if (r.FunctionError) throw new Error(`timeline write failed: ${r.FunctionError}`);
    },
  };
}
