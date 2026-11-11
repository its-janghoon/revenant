import { defineFunction } from "@aws-amplify/backend";

// Turns runner log lines (CloudWatch Logs subscription) into timeline events.
export const timeline = defineFunction({
  name: "timeline",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
