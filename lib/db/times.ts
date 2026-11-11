// The Data API reads a TIMESTAMP parameter only as "YYYY-MM-DD HH:MM:SS[.fff]". Code here passes
// ISO strings (toISOString()) and plain days ("2026-11-01"), so rewrite them before sending.
import type { RDSDataClient, SqlParameter } from "@aws-sdk/client-rds-data";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

/** "2026-11-01" -> "2026-11-01 00:00:00"; any ISO time -> the same instant in UTC. */
export function dataApiTime(v: string): string {
  if (DAY.test(v)) return `${v} 00:00:00`;
  if (ISO.test(v)) return new Date(v).toISOString().replace("T", " ").replace("Z", "");
  return v;
}

function fix(ps: SqlParameter[] | undefined): void {
  for (const p of ps ?? []) {
    if (p.typeHint === "TIMESTAMP" && p.value && "stringValue" in p.value && typeof p.value.stringValue === "string") {
      p.value = { stringValue: dataApiTime(p.value.stringValue) };
    }
  }
}

export function times<C extends RDSDataClient>(client: C): C {
  client.middlewareStack.add(
    (next) => async (args) => {
      const input = args.input as { parameters?: SqlParameter[]; parameterSets?: SqlParameter[][] };
      fix(input.parameters);
      for (const set of input.parameterSets ?? []) fix(set);
      return next(args);
    },
    { step: "initialize", name: "rvDataApiTimes" },
  );
  return client;
}
