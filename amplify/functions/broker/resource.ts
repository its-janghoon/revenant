import { defineFunction } from "@aws-amplify/backend";

// IAM work for the Revenant server (lib/broker). Environment and permissions are set in backend.ts.
export const broker = defineFunction({
  name: "broker",
  entry: "./handler.ts",
  timeoutSeconds: 120,
  memoryMB: 256,
});
