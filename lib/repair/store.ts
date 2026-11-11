// Store on Revenant's own tables (Drizzle over the Data API). Takes the db so it loads in a
// Lambda function, where lib/db/client ("server-only") cannot.
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { DEFAULT_SETTINGS, type Deploy, type Project, type Repair, type Run, type Settings } from "../contracts";
import * as schema from "../db/schema";
import type { Db } from "../timeline/lookup";
import type { Store } from "./ports";

const { projects, runs, deploys, repairs, settings } = schema;

export function dbStore(db: Db): Store {
  const one = async <T>(q: Promise<T[]>): Promise<T | null> => (await q)[0] ?? null;

  // repairs link to a project through the failed deploy or run
  const projectRepairs = (projectId: string) =>
    or(
      inArray(repairs.deployId, db.select({ id: deploys.id }).from(deploys).where(eq(deploys.projectId, projectId))),
      inArray(repairs.runId, db.select({ id: runs.id }).from(runs).where(eq(runs.projectId, projectId))),
    );

  return {
    project: (id) => one(db.select().from(projects).where(eq(projects.id, id)).limit(1)) as Promise<Project | null>,
    projectByApp: (appId) => one(db.select().from(projects).where(eq(projects.amplifyAppId, appId)).limit(1)) as Promise<Project | null>,
    async setProjectStatus(id, status) {
      await db.update(projects).set({ status }).where(eq(projects.id, id));
    },
    run: (id) => one(db.select().from(runs).where(eq(runs.id, id)).limit(1)) as Promise<Run | null>,
    runByBuild(buildId) {
      const uuid = buildId.split(":").pop()!;
      return one(db.select().from(runs).where(or(eq(runs.codebuildId, buildId), like(runs.codebuildId, `%:${uuid}`))).limit(1)) as Promise<Run | null>;
    },
    lastRun: (projectId) =>
      one(db.select().from(runs).where(eq(runs.projectId, projectId)).orderBy(desc(runs.startedAt)).limit(1)) as Promise<Run | null>,
    async addRun(r) {
      const [row] = await db.insert(runs).values({ ...r, status: "queued" }).returning();
      return row as Run;
    },
    async setRunBuild(id, codebuildId) {
      await db.update(runs).set({ codebuildId, status: "running" }).where(eq(runs.id, id));
    },
    deploy: (id) => one(db.select().from(deploys).where(eq(deploys.id, id)).limit(1)) as Promise<Deploy | null>,
    deployFor: (projectId, branch) =>
      one(
        db.select().from(deploys).where(and(eq(deploys.projectId, projectId), eq(deploys.branch, branch))).orderBy(desc(deploys.createdAt)).limit(1),
      ) as Promise<Deploy | null>,
    async addDeploy(v) {
      const [row] = await db.insert(deploys).values(v).returning();
      return row as Deploy;
    },
    async setDeployStatus(id, status) {
      await db.update(deploys).set({ status }).where(eq(deploys.id, id));
    },
    async latestRepair(projectId) {
      const latest = await one(db.select({ branch: repairs.branch }).from(repairs).where(projectRepairs(projectId)).orderBy(desc(repairs.createdAt)).limit(1));
      if (!latest) return [];
      return (await db
        .select()
        .from(repairs)
        .where(and(eq(repairs.branch, latest.branch), projectRepairs(projectId)))
        .orderBy(repairs.attempt)) as Repair[];
    },
    async fixNumber(projectId) {
      const [row] = await db.select({ n: sql<number>`count(distinct ${repairs.branch})::int` }).from(repairs).where(projectRepairs(projectId));
      return Number(row?.n ?? 0) + 1;
    },
    async addRepair(r) {
      const [row] = await db.insert(repairs).values(r).returning();
      return row as Repair;
    },
    async updateRepair(id, p) {
      await db.update(repairs).set(p).where(eq(repairs.id, id));
    },
    async setting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
      const row = await one(db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1));
      return (row?.value as Settings[K] | undefined) ?? DEFAULT_SETTINGS[key];
    },
  };
}

/** GET /api/projects/:id/repairs: every attempt of the project's repairs, newest first. */
export async function repairsFor(db: Db, projectId: string): Promise<Repair[]> {
  const rows = await db
    .select()
    .from(repairs)
    .where(
      or(
        inArray(repairs.deployId, db.select({ id: deploys.id }).from(deploys).where(eq(deploys.projectId, projectId))),
        inArray(repairs.runId, db.select({ id: runs.id }).from(runs).where(eq(runs.projectId, projectId))),
      ),
    )
    .orderBy(desc(repairs.createdAt), desc(repairs.attempt));
  return rows as Repair[];
}
