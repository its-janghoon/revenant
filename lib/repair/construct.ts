// EventBridge rules that start and advance repairs (Requirement 7.1), plus the permissions the
// repair function needs. Used from amplify/backend.ts:
//
//   new RepairRules(stack, "Repair", { handler: backend.repair.resources.lambda, runnerProject, ... })
//
// The handler is lib/repair/handler.ts. Rules:
// - Amplify job FAILED (build or Gen 2 backend deploy) and SUCCEED (to confirm a merged fix)
// - CloudFormation stack failures of Gen 2 branch stacks (amplify-<appId>-<branch>-branch-<hash>)
// - CodeBuild FAILED and SUCCEEDED of the shared runner project (failed runs, repair runs)
// - the health check failure that L2 puts on the default bus (events.ts healthFailedEntry)
import { Duration, Stack } from "aws-cdk-lib";
import { Rule, type EventPattern } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { HEALTH_FAILED, HEALTH_SOURCE } from "./events";

export interface RepairRulesProps {
  handler: IFunction; // runs lib/repair/handler.ts
  runnerProject: string; // shared CodeBuild runner project name, e.g. rv-runner
  promptBucket: string; // bucket for run prompts (runs/<app>/...)
  timelineFunction: string; // name of the timeline function (writes repair events)
  name: string; // rv-revenant-<env>, prefix of rule names
  db: { clusterArn: string; secretArn: string }; // Revenant's Aurora (Data API)
}

const STACK_FAILED = [
  "CREATE_FAILED", "UPDATE_FAILED", "ROLLBACK_COMPLETE", "ROLLBACK_FAILED",
  "UPDATE_ROLLBACK_COMPLETE", "UPDATE_ROLLBACK_FAILED", "IMPORT_ROLLBACK_COMPLETE",
];

export class RepairRules extends Construct {
  readonly rules: Rule[];

  constructor(scope: Construct, id: string, props: RepairRulesProps) {
    super(scope, id);
    const { handler, name } = props;
    const patterns: Record<string, EventPattern> = {
      amplify: {
        source: ["aws.amplify"],
        detailType: ["Amplify Deployment Status Change"],
        detail: { jobStatus: ["FAILED", "SUCCEED"] },
      },
      stack: {
        source: ["aws.cloudformation"],
        detailType: ["CloudFormation Stack Status Change"],
        detail: {
          "stack-id": [{ wildcard: "*:stack/amplify-*-branch-*" }],
          "status-details": { status: STACK_FAILED },
        },
      },
      build: {
        source: ["aws.codebuild"],
        detailType: ["CodeBuild Build State Change"],
        detail: { "project-name": [props.runnerProject], "build-status": ["FAILED", "SUCCEEDED"] },
      },
      health: { source: [HEALTH_SOURCE], detailType: [HEALTH_FAILED] },
    };
    const target = new LambdaFunction(handler, { retryAttempts: 2, maxEventAge: Duration.hours(1) });
    this.rules = Object.entries(patterns).map(
      ([key, eventPattern]) => new Rule(this, key, { ruleName: `${name}-repair-${key}`, eventPattern, targets: [target] }),
    );

    // What the handler reads and does. Scoped to Revenant's names (rv-*) where the API allows it.
    const { partition, region, account } = Stack.of(this);
    const at = `${region}:${account}`;
    const allow = (actions: string[], resources: string[]) =>
      handler.addToRolePolicy(new PolicyStatement({ actions, resources }));
    allow(["amplify:GetApp", "amplify:GetBranch", "amplify:UpdateBranch", "amplify:GetJob", "amplify:ListJobs", "amplify:StartJob"],
      [`arn:${partition}:amplify:${at}:apps/*`]);
    allow(["cloudformation:DescribeStackEvents"], [`arn:${partition}:cloudformation:${at}:stack/amplify-*`]);
    allow(["codebuild:StartBuild", "codebuild:BatchGetBuilds"], [`arn:${partition}:codebuild:${at}:project/${props.runnerProject}`]);
    allow(["logs:GetLogEvents"], [`arn:${partition}:logs:${at}:log-group:*`]);
    allow(["codecommit:GetBranch", "codecommit:GetCommit", "codecommit:GetDifferences"], [`arn:${partition}:codecommit:${at}:rv-*`]);
    allow(["ssm:GetParameter", "ssm:PutParameter"], [`arn:${partition}:ssm:${at}:parameter/amplify/*`]);
    allow(["s3:PutObject"], [`arn:${partition}:s3:::${props.promptBucket}/runs/*`]);
    allow(["iam:PassRole"], [`arn:${partition}:iam::${account}:role/rv-*-runner`]);
    allow(["lambda:InvokeFunction"], [`arn:${partition}:lambda:${at}:function:${props.timelineFunction}`]);
    allow(["rds-data:ExecuteStatement", "rds-data:BatchExecuteStatement"], [props.db.clusterArn]);
    allow(["secretsmanager:GetSecretValue"], [props.db.secretArn]);
  }
}
