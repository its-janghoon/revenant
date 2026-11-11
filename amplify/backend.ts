import { readFileSync } from "node:fs";
import { defineBackend } from "@aws-amplify/backend";
import { Duration, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import { BuildSpec, CfnProject, ComputeType, LinuxArmBuildImage, Project, Source } from "aws-cdk-lib/aws-codebuild";
import { Repository as GitRepository } from "aws-cdk-lib/aws-codecommit";
import { CfnUserPoolUser, CfnUserPoolUserToGroupAttachment } from "aws-cdk-lib/aws-cognito";
import { SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Repository, TagMutability } from "aws-cdk-lib/aws-ecr";
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { FilterPattern, LogGroup, RetentionDays, SubscriptionFilter } from "aws-cdk-lib/aws-logs";
import { LambdaDestination } from "aws-cdk-lib/aws-logs-destinations";
import { AuroraPostgresEngineVersion, ClusterInstance, Credentials, DatabaseCluster, DatabaseClusterEngine } from "aws-cdk-lib/aws-rds";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { CfnApplication } from "aws-cdk-lib/aws-servicecatalogappregistry";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "aws-cdk-lib/custom-resources";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { timeline } from "./functions/timeline/resource";
import { repair } from "./functions/repair/resource";
import { RUNNER_PREFIX } from "../lib/contracts";
import { RepairRules } from "../lib/repair/construct";

const backend = defineBackend({ auth, data, timeline, repair });

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
// The runner CodeBuild project (below) writes to this log group; lines that start with
// RUNNER_PREFIX (lib/contracts.ts) become timeline events.
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

// ---------- AppRegistry: Revenant itself in myApplications ----------
const application = new CfnApplication(backend.stack, "Application", {
  name,
  description: "Revenant, the app builder (this install)",
});
Tags.of(backend.stack).add("awsApplication", application.attrArn, {
  excludeResourceTypes: ["AWS::ServiceCatalogAppRegistry::Application"],
});

// ---------- runner: the shared CodeBuild project every run uses (runner/) ----------
const runnerStack = backend.createStack("runner");
const { account, region, partition } = Stack.of(runnerStack);
const arn = (service: string, resource: string) => `arn:${partition}:${service}:${region}:${account}:${resource}`;
const sourceBranch = branch ?? "main";
// Revenant's own source in this account, created by infra/install.yaml.
const source = GitRepository.fromRepositoryName(runnerStack, "Source", "rv-revenant");

// Requests, change text and attachments the runner reads, under runs/<app>/.
const prompts = new Bucket(runnerStack, "Prompts", {
  bucketName: `${name}-prompts-${account}-${region}`,
  blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
  encryption: BucketEncryption.S3_MANAGED,
  enforceSSL: true,
  lifecycleRules: [{ prefix: "runs/", expiration: Duration.days(30) }],
  removalPolicy: RemovalPolicy.RETAIN,
});

// Runner image: runner/Dockerfile, built in CodeBuild (Amplify builds have no Docker).
const images = new Repository(runnerStack, "Images", {
  repositoryName: `${name}-runner`,
  imageTagMutability: TagMutability.MUTABLE,
  imageScanOnPush: true,
  lifecycleRules: [{ maxImageCount: 5 }],
  removalPolicy: RemovalPolicy.RETAIN,
});
const imageBuild = new Project(runnerStack, "RunnerImage", {
  projectName: `${name}-runner-image`,
  description: "Builds runner/Dockerfile into the Revenant runner image",
  source: Source.codeCommit({ repository: source, branchOrRef: sourceBranch }),
  environment: { buildImage: LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0, computeType: ComputeType.SMALL, privileged: true },
  environmentVariables: { IMAGE: { value: images.repositoryUri } },
  timeout: Duration.minutes(30),
  buildSpec: BuildSpec.fromObject({
    version: "0.2",
    phases: {
      pre_build: { commands: ['aws ecr get-login-password | docker login --username AWS --password-stdin "${IMAGE%%/*}"'] },
      build: { commands: ['docker build --platform linux/arm64 -f runner/Dockerfile -t "$IMAGE:latest" -t "$IMAGE:$CODEBUILD_RESOLVED_SOURCE_VERSION" .'] },
      post_build: { commands: ['[ "$CODEBUILD_BUILD_SUCCEEDING" = 1 ] && docker push --all-tags "$IMAGE"'] },
    },
  }),
});
images.grantPullPush(imageBuild);
// Rebuild the image for every deployed commit. Runs started before it finishes use the previous image.
const commit = process.env.AWS_COMMIT_ID?.trim();
const startImage = {
  service: "CodeBuild",
  action: "startBuild",
  parameters: {
    projectName: imageBuild.projectName,
    sourceVersion: commit && commit !== "HEAD" ? commit : `refs/heads/${sourceBranch}`,
  },
  physicalResourceId: PhysicalResourceId.of(`${name}-runner-image`),
};
new AwsCustomResource(runnerStack, "BuildRunnerImage", {
  onCreate: startImage,
  onUpdate: startImage,
  policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [imageBuild.projectArn] }),
  installLatestAwsSdk: false,
});

// Per-app runner roles (runner/role.ts, Requirement 10.4): Revenant creates rv-<app>-runner
// with the inline policy from runner/role.ts, attaches RunnerBase, and must set RunnerBoundary
// as the permissions boundary (the compute role cannot create the role without it).
// Every run passes that role to StartBuild as serviceRoleOverride.
const pullImage = [
  new PolicyStatement({
    actions: ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"],
    resources: [images.repositoryArn],
  }),
  new PolicyStatement({ actions: ["ecr:GetAuthorizationToken"], resources: ["*"] }), // no resource-level permissions
];
const runnerBase = new ManagedPolicy(runnerStack, "RunnerBase", {
  managedPolicyName: `${name}-runner-base`,
  description: "Attached to every rv-<app>-runner role: pull the runner image",
  statements: pullImage,
});
const runnerBoundary = new ManagedPolicy(runnerStack, "RunnerBoundary", {
  managedPolicyName: `${name}-runner-boundary`,
  description: "Permissions boundary of every rv-<app>-runner role: the most a run can ever do",
  statements: [
    ...pullImage,
    new PolicyStatement({
      actions: ["codecommit:GitPull", "codecommit:GitPush", "codecommit:GetRepository", "codecommit:GetBranch"],
      resources: [arn("codecommit", "rv-*")],
    }),
    new PolicyStatement({ actions: ["s3:GetObject"], resources: [prompts.arnForObjects("runs/*")] }),
    new PolicyStatement({ actions: ["s3:ListBucket"], resources: [prompts.bucketArn] }),
    new PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      resources: [arn("secretsmanager", "secret:rv/kiro/*"), arn("secretsmanager", "secret:rv-revenant-kiro-*")],
    }),
    new PolicyStatement({ actions: ["logs:CreateLogStream", "logs:PutLogEvents"], resources: [runnerLogs.logGroupArn] }),
    // SQL apps (blocks/db): the app's dev and preview databases through the Data API.
    new PolicyStatement({
      actions: ["rds-data:ExecuteStatement", "rds-data:BatchExecuteStatement", "rds-data:BeginTransaction", "rds-data:CommitTransaction", "rds-data:RollbackTransaction"],
      resources: [arn("rds", "cluster:rv-*")],
    }),
    new PolicyStatement({ actions: ["secretsmanager:GetSecretValue"], resources: [arn("secretsmanager", "secret:rv-*-db-*")] }),
    // Never Revenant's own database or app key.
    new PolicyStatement({
      effect: Effect.DENY,
      actions: ["rds-data:*", "secretsmanager:*"],
      resources: [arn("rds", "cluster:rv-revenant-*"), arn("secretsmanager", "secret:rv-revenant-*-db-*"), arn("secretsmanager", "secret:rv-revenant-appkey-*")],
    }),
  ],
});
// CodeBuild needs a project role; every run overrides it with rv-<app>-runner.
const runnerDefault = new Role(runnerStack, "RunnerDefault", {
  roleName: `${name}-runner-default`,
  description: "Default role of the runner project; runs always override it with rv-<app>-runner",
  assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
  managedPolicies: [runnerBase],
  permissionsBoundary: runnerBoundary,
});
const runner = new CfnProject(runnerStack, "Runner", {
  name: `${name}-runner`,
  description: "Revenant runner: Kiro CLI headless on one app repo (runner/)",
  serviceRole: runnerDefault.roleArn,
  artifacts: { type: "NO_ARTIFACTS" },
  source: { type: "NO_SOURCE", buildSpec: readFileSync(new URL("../runner/buildspec.yml", import.meta.url), "utf8") },
  environment: {
    type: "ARM_CONTAINER",
    computeType: "BUILD_GENERAL1_MEDIUM",
    image: images.repositoryUriForTag("latest"),
    imagePullCredentialsType: "SERVICE_ROLE",
  },
  timeoutInMinutes: 60, // each run sets TIME_LIMIT_MIN + 5
  queuedTimeoutInMinutes: 60,
  logsConfig: { cloudWatchLogs: { status: "ENABLED", groupName: runnerLogs.logGroupName } },
});

// ---------- repair: EventBridge failure rules (lib/repair/construct.ts, lane L4) ----------
const kiroSecretArn = process.env.RV_KIRO_SECRET_ARN?.startsWith("arn:")
  ? process.env.RV_KIRO_SECRET_ARN
  : Secret.fromSecretNameV2(runnerStack, "KiroSecret", "rv-revenant-kiro").secretArn;
{
  const fn = backend.repair.resources.lambda as import("aws-cdk-lib/aws-lambda").Function;
  fn.addEnvironment("RV_DB_CLUSTER_ARN", cluster.clusterArn);
  fn.addEnvironment("RV_DB_SECRET_ARN", cluster.secret!.secretArn);
  fn.addEnvironment("RV_DB_NAME", "revenant");
  fn.addEnvironment("RV_RUNNER_PROJECT", runner.ref);
  fn.addEnvironment("RV_PROMPT_BUCKET", prompts.bucketName);
  fn.addEnvironment("RV_TIMELINE_FUNCTION", backend.timeline.resources.lambda.functionName);
  // The company Kiro key (infra/install.yaml KiroSecret, output KiroSecretArn). The install sets
  // RV_KIRO_SECRET_ARN on the Amplify app, so the backend build sees it; a sandbox without it
  // uses the install's fixed secret name (a partial ARN, which Secrets Manager accepts).
  fn.addEnvironment("RV_KIRO_SECRET_ARN", kiroSecretArn);
}
new RepairRules(backend.createStack("repair"), "Repair", {
  handler: backend.repair.resources.lambda,
  runnerProject: runner.ref,
  promptBucket: prompts.bucketName,
  timelineFunction: backend.timeline.resources.lambda.functionName,
  name,
  db: { clusterArn: cluster.clusterArn, secretArn: cluster.secret!.secretArn },
});

backend.addOutput({
  custom: {
    name,
    db: { clusterArn: cluster.clusterArn, secretArn: cluster.secret!.secretArn, database: "revenant" },
    runnerLogGroup: runnerLogs.logGroupName,
    timelineFunction: backend.timeline.resources.lambda.functionArn,
    application: application.attrArn,
    runner: {
      project: runner.ref,
      imageProject: imageBuild.projectName,
      image: images.repositoryUriForTag("latest"),
      promptBucket: prompts.bucketName,
      basePolicyArn: runnerBase.managedPolicyArn,
      boundaryArn: runnerBoundary.managedPolicyArn,
    },
  },
});
