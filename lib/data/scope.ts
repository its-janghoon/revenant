// What an SQL app's runner may reach (Requirement 6.10): the dev cluster (<app>_dev and its
// previews) through the Data API, never prod. Only the main branch build (publish) writes prod.
//
//   policy({ ..., extra: runnerStatements(scopeInput) })   // runner/role.ts
//   StartBuild environmentVariablesOverride: runnerEnv(dev, branch)
import { clusterName, dbName, previewEnv } from "./names";

// Same shape as runner/role.ts Statement.
export type Statement = {
  Sid?: string;
  Effect: "Allow" | "Deny";
  Action: string[];
  Resource: string[];
};

export type ScopeInput = {
  partition?: string;
  region: string;
  account: string;
  app: string;
  dev: { clusterArn: string; secretArn: string };
};

const DATA_API = [
  "rds-data:ExecuteStatement", "rds-data:BatchExecuteStatement", "rds-data:BeginTransaction",
  "rds-data:CommitTransaction", "rds-data:RollbackTransaction",
];

export function runnerStatements(i: ScopeInput): Statement[] {
  const p = i.partition ?? "aws";
  const at = `${i.region}:${i.account}`;
  const prod = clusterName(i.app, "prod");
  return [
    { Sid: "DevDb", Effect: "Allow", Action: DATA_API, Resource: [i.dev.clusterArn] },
    { Sid: "DevDbSecret", Effect: "Allow", Action: ["secretsmanager:GetSecretValue"], Resource: [i.dev.secretArn] },
    // Explicit deny wins over anything else attached to the role.
    {
      Sid: "NoProdDb",
      Effect: "Deny",
      Action: [...DATA_API, "rds-db:connect", "rds:CreateDBClusterSnapshot", "rds:ModifyDBCluster", "rds:DeleteDBCluster"],
      Resource: [`arn:${p}:rds:${at}:cluster:${prod}`, `arn:${p}:rds-db:${at}:dbuser:*/*`],
    },
    {
      Sid: "NoProdDbSecret",
      Effect: "Deny",
      Action: ["secretsmanager:GetSecretValue"],
      Resource: [`arn:${p}:secretsmanager:${at}:secret:${prod}-db-*`],
    },
  ];
}

/** CodeBuild env for a run: the database of the branch it works on (preview/<n> or dev). */
export function runnerEnv(app: string, dev: { clusterArn: string; secretArn: string }, branch: string) {
  const db = /^preview[-/]?\d+$/.test(branch) ? dbName(app, previewEnv(branch)) : dbName(app, "dev");
  return [
    { name: "DB_CLUSTER_ARN", value: dev.clusterArn, type: "PLAINTEXT" as const },
    { name: "DB_SECRET_ARN", value: dev.secretArn, type: "PLAINTEXT" as const },
    { name: "DB_NAME", value: db, type: "PLAINTEXT" as const },
  ];
}
