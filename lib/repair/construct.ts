// Stub from lane X so amplify/backend.ts can wire repair in. Lane L4 owns this file and
// replaces the body: EventBridge rules on Amplify job FAILED, CloudFormation stack failures of
// the apps' Gen 2 deploys and runner CodeBuild FAILED, each starting a repair run.
// Keep the class name and the props; add props if needed and update amplify/backend.ts.
import { Construct } from "constructs";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import type { ILogGroup } from "aws-cdk-lib/aws-logs";

export interface RepairProps {
  /** rv-revenant-<env>; prefix for every resource name. */
  name: string;
  /** The shared runner CodeBuild project (repair runs use it with mode=repair). */
  runnerProjectName: string;
  runnerProjectArn: string;
  /** Runner output, for gathering the failed run's log lines. */
  runnerLogs: ILogGroup;
  /** Writes timeline events (`{ events: TimelineEvent[] }`). */
  timeline: IFunction;
}

export class Repair extends Construct {
  constructor(scope: Construct, id: string, readonly props: RepairProps) {
    super(scope, id);
  }
}
