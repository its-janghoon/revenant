import { defineFunction } from "@aws-amplify/backend";

// Revenant's clock: every 5 minutes it asks the server to run its scheduled jobs (queued deploys,
// hourly cleanup, daily cost job). Environment and the secret grant are set in backend.ts.
export const tick = defineFunction({
  name: "tick",
  entry: "./handler.ts",
  schedule: "every 5m",
  timeoutSeconds: 90,
  memoryMB: 128,
});
