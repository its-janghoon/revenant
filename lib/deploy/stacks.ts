// Deployed templates of an Amplify branch's backend: the root stack and every nested stack,
// keyed by logical id path ("root", "data7552DF31", "data7552DF31/Note..."). The same code on
// two branches gives the same keys, so main and a preview compare stack by stack.
import "server-only";
import { GetTemplateCommand, ListStackResourcesCommand, type StackResourceSummary } from "@aws-sdk/client-cloudformation";
import type { Stacks, Template } from "../guard";
import { cfn } from "./aws";
import { backendStack } from "./amplify";

export interface Deployed {
  stacks: Stacks;
  /** Strings that name this environment (stack names), for normalize(). */
  tokens: string[];
  /** Physical ids by resource type, across all stacks (for record counts). */
  physical: { stack: string; id: string; type: string; physicalId: string }[];
}

async function resourcesOf(stack: string): Promise<StackResourceSummary[]> {
  const out: StackResourceSummary[] = [];
  let next: string | undefined;
  do {
    const r = await cfn.send(new ListStackResourcesCommand({ StackName: stack, NextToken: next }));
    out.push(...(r.StackResourceSummaries ?? []));
    next = r.NextToken;
  } while (next);
  return out;
}

const nameOf = (arn: string) => arn.split("/")[1] ?? arn;

export async function deployed(appId: string, branch: string): Promise<Deployed | null> {
  const root = await backendStack(appId, branch);
  if (!root) return null;
  const out: Deployed = { stacks: {}, tokens: [], physical: [] };
  const visit = async (arn: string, key: string, depth: number) => {
    const t = await cfn.send(new GetTemplateCommand({ StackName: arn, TemplateStage: "Original" }));
    out.stacks[key] = JSON.parse(t.TemplateBody ?? "{}") as Template;
    out.tokens.push(nameOf(arn));
    const res = await resourcesOf(arn);
    for (const r of res) {
      if (r.PhysicalResourceId && r.LogicalResourceId && r.ResourceType) {
        out.physical.push({ stack: key, id: r.LogicalResourceId, type: r.ResourceType, physicalId: r.PhysicalResourceId });
      }
    }
    if (depth > 5) return;
    await Promise.all(
      res
        .filter((r) => r.ResourceType === "AWS::CloudFormation::Stack" && r.PhysicalResourceId)
        .map((r) => visit(r.PhysicalResourceId!, key === "root" ? r.LogicalResourceId! : `${key}/${r.LogicalResourceId}`, depth + 1)),
    );
  };
  await visit(root, "root", 0);
  return out;
}
