// Home-screen and per-project cost (Requirement 8.1-8.3).
// Account totals come from Cost Explorer (cached for an hour per server instance, since
// each request costs money); per-project cost comes from the costs table the daily job fills.
import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import type { CostSummary } from "../contracts";
import { db, schema } from "../db/client";
import { kiroCredits, type KiroSplit } from "./credits";
import { addDays, day, forecastRest, monthStart, total } from "./explorer";
import { budgetUsd, creditsGrantedUsd } from "./settings";

const HOUR = 3_600_000;
interface Account { monthUsd: number; forecastUsd: number | null; creditsUsedUsd: number }
let cache: { at: number; value: Promise<Account> } | null = null;

// Month to date runs through yesterday; the forecast covers today to the end of the month.
async function readAccount(now: Date): Promise<Account> {
  const today = day(now);
  const month = { start: day(monthStart(now)), end: today };
  // Cost Explorer keeps about 13 months of history.
  const year = { start: day(monthStart(addDays(monthStart(now), -365))), end: today };
  const [monthUsd, rest, creditsUsedUsd] = await Promise.all([total(month, "Usage"), forecastRest(now), total(year, "Credit")]);
  return { monthUsd, forecastUsd: rest === null ? null : monthUsd + rest, creditsUsedUsd };
}

function account(now: Date): Promise<Account> {
  if (!cache || now.getTime() - cache.at > HOUR) {
    const value = readAccount(now);
    cache = { at: now.getTime(), value };
    value.catch(() => { if (cache?.value === value) cache = null; }); // retry on the next call
  }
  return cache.value;
}

const round = (n: number) => Math.round(n * 100) / 100;

export interface CostHome extends CostSummary { kiro: KiroSplit }

/** AWS credits left, month to date, forecast, budget, and Kiro credits this month. */
export async function costSummary(now = new Date(), owner?: string): Promise<CostHome> {
  const [a, budget, granted, kiro] = await Promise.all([
    account(now),
    budgetUsd(),
    creditsGrantedUsd(),
    kiroCredits({ owner, since: monthStart(now).toISOString() }),
  ]);
  const { byProject: _p, byOwner: _o, ...split } = kiro;
  return {
    creditsLeftUsd: granted === null ? null : round(Math.max(0, granted - a.creditsUsedUsd)),
    monthUsd: round(a.monthUsd),
    forecastUsd: a.forecastUsd === null ? null : round(a.forecastUsd),
    budgetUsd: budget,
    overBudget: (a.forecastUsd ?? a.monthUsd) > budget,
    kiro: split,
  };
}

/** Budget warning for every screen (Requirement 8.3). Never throws: a failed read shows no warning. */
export async function budgetWarning(): Promise<{ overBudget: boolean; forecastUsd: number | null; budgetUsd: number } | null> {
  try {
    const s = await costSummary();
    return { overBudget: s.overBudget, forecastUsd: s.forecastUsd, budgetUsd: s.budgetUsd };
  } catch {
    return null;
  }
}

export interface ProjectCost {
  projectId: string;
  monthUsd: number; // usage month to date
  monthCreditUsd: number; // AWS credits applied month to date
  days: { day: string; usageUsd: number; creditUsd: number }[];
  kiro: KiroSplit; // this month
  kiroAll: KiroSplit; // since the project started
}

export async function projectCost(projectId: string, now = new Date()): Promise<ProjectCost> {
  const first = day(monthStart(now));
  const since = monthStart(now).toISOString();
  const [rows, month, all] = await Promise.all([
    db.select({ day: schema.costs.day, usage: schema.costs.usageUsd, credit: schema.costs.creditUsd })
      .from(schema.costs)
      .where(and(eq(schema.costs.projectId, projectId), gte(schema.costs.day, first)))
      .orderBy(asc(schema.costs.day)),
    kiroCredits({ projectId, since }),
    kiroCredits({ projectId }),
  ]);
  const days = rows.map((r) => ({ day: r.day, usageUsd: Number(r.usage), creditUsd: Number(r.credit) }));
  const strip = ({ byProject: _p, byOwner: _o, ...s }: typeof month): KiroSplit => s;
  return {
    projectId,
    monthUsd: round(days.reduce((s, d) => s + d.usageUsd, 0)),
    monthCreditUsd: round(days.reduce((s, d) => s + d.creditUsd, 0)),
    days,
    kiro: strip(month),
    kiroAll: strip(all),
  };
}

/** Month-to-date usage per project, for the admin apps list and the Crew dashboard. */
export async function costsByProject(now = new Date()): Promise<Record<string, number>> {
  const rows = await db
    .select({ projectId: schema.costs.projectId, usd: sql<string>`sum(${schema.costs.usageUsd})` })
    .from(schema.costs)
    .where(gte(schema.costs.day, day(monthStart(now))))
    .groupBy(schema.costs.projectId);
  return Object.fromEntries(rows.map((r) => [r.projectId, round(Number(r.usd))]));
}
