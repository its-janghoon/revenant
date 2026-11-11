import { defineBackend } from "@aws-amplify/backend";
import { Duration, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import { CfnUserPoolUser, CfnUserPoolUserToGroupAttachment } from "aws-cdk-lib/aws-cognito";
import { SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { FilterPattern, LogGroup, RetentionDays, SubscriptionFilter } from "aws-cdk-lib/aws-logs";
import { LambdaDestination } from "aws-cdk-lib/aws-logs-destinations";
import { AuroraPostgresEngineVersion, ClusterInstance, Credentials, DatabaseCluster, DatabaseClusterEngine } from "aws-cdk-lib/aws-rds";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { timeline } from "./functions/timeline/resource";
import { RUNNER_PREFIX } from "../lib/contracts";

const backend = defineBackend({ auth, data, timeline });

// rv-revenant-<env>: "prod" on main, the branch name elsewhere, "dev" in a sandbox.
const branch = process.env.AWS_BRANCH;
const envName = !branch ? "dev" : branch === "main" ? "prod" : branch.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12);
const name = `rv-revenant-${envName}`;
Tags.of(backend.stack).add("revenant:app", "revenant");
Tags.of(backend.stack).add("revenant:env", envName);

// ---------- auth: invite only, admin from the install parameter ----------
const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true };

const adminEmail = process.env.ADMIN_EMAIL;
if (adminEmail && envName === "prod") {
  const admin = new CfnUserPoolUser(backend.auth.stack, "Admin", {
    userPoolId: backend.auth.resources.userPool.userPoolId,
    username: adminEmail,
    desiredDeliveryMediums: ["EMAIL"],
    userAttributes: [{ name: "email", value: adminEmail }, { name: "email_verified", value: "true" }],
  });
  const attach = new CfnUserPoolUserToGroupAttachment(backend.auth.stack, "AdminGroup", {
    userPoolId: backend.auth.resources.userPool.userPoolId,
    groupName: "admin",
    username: adminEmail,
  });
  attach.addDependency(admin);
  attach.node.addDependency(backend.auth.resources.groups["admin"].cfnUserGroup);
}

// ---------- Revenant's own database: Aurora Serverless v2 (min 0 ACU), Data API only ----------
// Isolated subnets: no internet, no NAT, nothing can connect except through the Data API.
const dbStack = backend.createStack("db");
const vpc = new Vpc(dbStack, "Vpc", {
  vpcName: name,
  maxAzs: 2,
  natGateways: 0,
  subnetConfiguration: [{ name: "db", subnetType: SubnetType.PRIVATE_ISOLATED, cidrMask: 24 }],
});
const cluster = new DatabaseCluster(dbStack, "Db", {
  clusterIdentifier: name,
  engine: DatabaseClusterEngine.auroraPostgres({ version: AuroraPostgresEngineVersion.VER_16_6 }),
  credentials: Credentials.fromGeneratedSecret("revenant", { secretName: `${name}-db` }),
  defaultDatabaseName: "revenant",
  writer: ClusterInstance.serverlessV2("writer"),
  serverlessV2MinCapacity: 0,
  serverlessV2MaxCapacity: 4,
  enableDataApi: true,
  storageEncrypted: true,
  vpc,
  vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
  backup: { retention: Duration.days(7) },
  deletionProtection: envName === "prod",
  removalPolicy: envName === "prod" ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
});

// ---------- runner logs -> timeline ----------
// Fixed name so the install's compute role can invoke it (server events) by name.
backend.timeline.resources.cfnResources.cfnFunction.functionName = `${name}-timeline`;
// The runner CodeBuild project (runner/) writes to this log group; lines that start with
// RUNNER_PREFIX become timeline events.
const runnerLogs = new LogGroup(Stack.of(backend.timeline.resources.lambda), "RunnerLogs", {
  logGroupName: `/rv/${name}/runner`,
  retention: RetentionDays.ONE_MONTH,
  removalPolicy: RemovalPolicy.RETAIN,
});
new SubscriptionFilter(Stack.of(backend.timeline.resources.lambda), "RunnerLines", {
  logGroup: runnerLogs,
  destination: new LambdaDestination(backend.timeline.resources.lambda),
  filterPattern: FilterPattern.literal(`"${RUNNER_PREFIX.trim()}"`),
});

backend.addOutput({
  custom: {
    name,
    db: { clusterArn: cluster.clusterArn, secretArn: cluster.secret!.secretArn, database: "revenant" },
    runnerLogGroup: runnerLogs.logGroupName,
    timelineFunction: backend.timeline.resources.lambda.functionArn,
  },
});
