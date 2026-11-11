import { defineFunction } from "@aws-amplify/backend";

// Repair rules handler (lib/repair). Environment is set in backend.ts from the real resources.
export const repair = defineFunction({
  name: "repair",
  entry: "./handler.ts",
  timeoutSeconds: 120,
  memoryMB: 512,
});
