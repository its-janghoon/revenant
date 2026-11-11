// Revenant's own tables (Aurora Postgres via the Data API). Every change ships with a
// new migration in lib/db/migrations (npm run db:generate). Never edit an applied migration.
import { sql } from "drizzle-orm";
import {
  boolean, date, doublePrecision, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";
import type {
  CheckStatus, DeployStatus, KiroPayer, ProjectStatus, RepairOutcome, RunMode, RunStatus, TaskState,
} from "../contracts";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const projectId = () => uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" });

export const projects = pgTable("projects", {
  id: id(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  request: text("request").notNull(),
  repo: text("repo"),
  amplifyAppId: text("amplify_app_id"),
  prodUrl: text("prod_url"),
  status: text("status").$type<ProjectStatus>().notNull().default("spec"),
  createdAt: ts("created_at").notNull().defaultNow(),
  expiresAt: ts("expires_at"),
}, (t) => [index("projects_owner_idx").on(t.owner), unique("projects_name_key").on(t.name)]);

export const runs = pgTable("runs", {
  id: id(),
  projectId: projectId(),
  mode: text("mode").$type<RunMode>().notNull(),
  model: text("model").notNull().default("auto"),
  kiroPayer: text("kiro_payer").$type<KiroPayer>().notNull(),
  commit: text("commit"),
  codebuildId: text("codebuild_id"),
  status: text("status").$type<RunStatus>().notNull().default("queued"),
  credits: doublePrecision("credits"),
  startedAt: ts("started_at").notNull().defaultNow(),
  endedAt: ts("ended_at"),
}, (t) => [index("runs_project_idx").on(t.projectId)]);

export const tasks = pgTable("tasks", {
  id: id(),
  projectId: projectId(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  state: text("state").$type<TaskState>().notNull().default("todo"),
}, (t) => [unique("tasks_project_number_key").on(t.projectId, t.number)]);

export const deploys = pgTable("deploys", {
  id: id(),
  projectId: projectId(),
  branch: text("branch").notNull(),
  commit: text("commit").notNull(),
  status: text("status").$type<DeployStatus>().notNull().default("pending"),
  url: text("url"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("deploys_project_idx").on(t.projectId)]);

export const repairs = pgTable("repairs", {
  id: id(),
  deployId: uuid("deploy_id").references(() => deploys.id, { onDelete: "cascade" }),
  runId: uuid("run_id").references(() => runs.id, { onDelete: "cascade" }),
  attempt: integer("attempt").notNull(),
  cause: text("cause"),
  branch: text("branch").notNull(),
  checkStatus: text("check_status").$type<CheckStatus>().notNull().default("pending"),
  outcome: text("outcome").$type<RepairOutcome>().notNull().default("running"),
  recoveredS: integer("recovered_s"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const previews = pgTable("previews", {
  id: id(),
  projectId: projectId(),
  branch: text("branch").notNull(),
  dbName: text("db_name"),
  createdAt: ts("created_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
}, (t) => [index("previews_project_idx").on(t.projectId)]);

export const costs = pgTable("costs", {
  projectId: projectId(),
  day: date("day", { mode: "string" }).notNull(),
  usageUsd: numeric("usage_usd", { precision: 12, scale: 4 }).notNull().default("0"),
  creditUsd: numeric("credit_usd", { precision: 12, scale: 4 }).notNull().default("0"),
}, (t) => [primaryKey({ columns: [t.projectId, t.day] })]);

// key is one of keyof Settings in lib/contracts.ts; value is its JSON value.
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const userPolicies = pgTable("user_policies", {
  userId: text("user_id").primaryKey(),
  sqlAllowed: boolean("sql_allowed"), // null = follow the install setting
});

export const audit = pgTable("audit", {
  id: id(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail"),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("audit_at_idx").on(t.at)]);
