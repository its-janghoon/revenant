import { defineConfig } from "drizzle-kit";

// `npm run db:generate` writes a new migration from lib/db/schema.ts. It needs no database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
});
