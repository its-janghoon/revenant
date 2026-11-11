// Aurora at 0 ACU pauses when idle. The first Data API call wakes it and fails with
// DatabaseResumingException until it is up (about 15-30 s), so retry that one error.
import type { RDSDataClient } from "@aws-sdk/client-rds-data";

const TRIES = 12;
const WAIT_MS = 5_000;

export function wake<C extends RDSDataClient>(client: C): C {
  client.middlewareStack.add(
    (next) => async (args) => {
      for (let i = 1; ; i++) {
        try {
          return await next(args);
        } catch (e) {
          if (i >= TRIES || (e as { name?: string }).name !== "DatabaseResumingException") throw e;
          await new Promise((r) => setTimeout(r, WAIT_MS));
        }
      }
    },
    { step: "initialize", name: "rvWakeDatabase" },
  );
  return client;
}
