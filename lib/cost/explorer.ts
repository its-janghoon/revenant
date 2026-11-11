// Cost Explorer reads (Requirement 8.1-8.3). Cost Explorer is a us-east-1 endpoint and
// costs $0.01 per request, so callers cache (summary.ts) or run once a day (job.ts).
// Dates are UTC YYYY-MM-DD; End is exclusive.
import "server-only";
import {
  CostExplorerClient,
  DataUnavailableException,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  UpdateCostAllocationTagsStatusCommand,
  type Expression,
  type GetCostAndUsageCommandOutput,
} from "@aws-sdk/client-cost-explorer";

const ce = new CostExplorerClient({ region: "us-east-1" });

export const PROJECT_TAG = "revenant:project";
export type RecordType = "Usage" | "Credit";
export interface Range { start: string; end: string }

const recordType = (r: RecordType): Expression => ({ Dimensions: { Key: "RECORD_TYPE", Values: [r] } });
const amount = (m: { Amount?: string } | undefined) => Number(m?.Amount ?? 0);

export const day = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(d: Date, n: number): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
export const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
export const nextMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

async function pages(input: ConstructorParameters<typeof GetCostAndUsageCommand>[0]) {
  const out: GetCostAndUsageCommandOutput["ResultsByTime"] = [];
  let token: string | undefined;
  do {
    const r = await ce.send(new GetCostAndUsageCommand({ ...input, NextPageToken: token }));
    out.push(...(r.ResultsByTime ?? []));
    token = r.NextPageToken;
  } while (token);
  return out;
}

/** project id -> day -> USD, from the revenant:project tag. Credits come back positive. */
export async function byProject(range: Range, record: RecordType): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();
  if (range.start >= range.end) return out;
  const results = await pages({
    TimePeriod: { Start: range.start, End: range.end },
    Granularity: "DAILY",
    Metrics: ["UnblendedCost"],
    GroupBy: [{ Type: "TAG", Key: PROJECT_TAG }],
    Filter: recordType(record),
  });
  for (const r of results ?? []) {
    const d = r.TimePeriod?.Start;
    if (!d) continue;
    for (const g of r.Groups ?? []) {
      const project = (g.Keys?.[0] ?? "").split("$")[1]; // "revenant:project$<id>"; "" = untagged
      if (!project) continue;
      const usd = Math.abs(amount(g.Metrics?.UnblendedCost));
      const days = out.get(project) ?? new Map<string, number>();
      days.set(d, (days.get(d) ?? 0) + usd);
      out.set(project, days);
    }
  }
  return out;
}

/** Account-wide total for the range. Credits come back positive. */
export async function total(range: Range, record: RecordType): Promise<number> {
  if (range.start >= range.end) return 0;
  const results = await pages({
    TimePeriod: { Start: range.start, End: range.end },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
    Filter: recordType(record),
  });
  return Math.abs((results ?? []).reduce((s, r) => s + amount(r.Total?.UnblendedCost), 0));
}

/** Forecast usage from today to the end of the month; null while AWS has too little history. */
export async function forecastRest(now: Date): Promise<number | null> {
  try {
    const r = await ce.send(new GetCostForecastCommand({
      TimePeriod: { Start: day(now), End: day(nextMonth(now)) },
      Metric: "UNBLENDED_COST",
      Granularity: "MONTHLY",
      Filter: recordType("Usage"),
    }));
    return amount(r.Total);
  } catch (e) {
    if (e instanceof DataUnavailableException) return null;
    throw e;
  }
}

/**
 * Turns on revenant:project as a cost allocation tag. Only works in a standalone or
 * management account; in an Organizations member account the management account does it.
 * Returns false when it could not.
 */
export async function activateTag(): Promise<boolean> {
  try {
    const r = await ce.send(new UpdateCostAllocationTagsStatusCommand({
      CostAllocationTagsStatus: [{ TagKey: PROJECT_TAG, Status: "Active" }],
    }));
    return !r.Errors?.length;
  } catch {
    return false;
  }
}
