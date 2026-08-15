import { defineConfig } from "drizzle-kit";

// generate-only config: `drizzle-kit generate` emits SQL migrations into ./drizzle.
// They are applied to D1 with `wrangler d1 migrations apply pebbly [--local|--remote]`,
// so no live DB connection (driver) is required here.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
});
