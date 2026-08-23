import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Studio dashboard for the remote (production) D1 database.
 *
 *   pnpm db:studio
 *
 * Uses the `d1-http` driver (Cloudflare API) — no local sqlite client needed.
 * Credentials come from the environment:
 *   - CLOUDFLARE_API_TOKEN  (API token with "D1 Edit" permission)
 *   - CLOUDFLARE_ACCOUNT_ID (Cloudflare account id)
 * The database id is read from wrangler.toml.
 *
 * For the local D1 database use:
 *   wrangler d1 execute pebbly --local --command "SELECT * FROM watch_items;"
 */

function fail(message: string): never {
  console.error(`[drizzle.studio.config.ts] ${message}`);
  console.error(
    "Set the missing values (see .env.example) and re-run `pnpm db:studio`.",
  );
  process.exit(1);
}

/**
 * Read the top-level `database_id` from wrangler.toml.
 *
 * wrangler.toml is TOML, so we parse the top-level `d1_databases` array and
 * take the `database_id` of the entry named `pebbly` (falling back to the
 * first entry). Regex extraction is deliberately avoided so environment
 * blocks (`[env.production]`) cannot shadow the top-level database id.
 */
function readWranglerDatabaseId(): string {
  const raw = readWranglerToml();

  // wrangler.toml uses TOML array-of-tables syntax (`[[d1_databases]]`).
  // Split the file on each `[[d1_databases]]` header and parse only the
  // top-level section — `[env.*]` blocks are ignored entirely, so an
  // environment-specific D1 cannot shadow the intended database id.
  const sections = raw.split(/^\[\[d1_databases\]\]/m).slice(1);
  if (sections.length === 0) {
    fail(
      "Could not find a top-level `[[d1_databases]]` table in wrangler.toml.",
    );
  }

  const parseSection = (section: string): Record<string, string> => {
    const values: Record<string, string> = {};
    for (const line of section.split("\n")) {
      // Stop at the next top-level table/array header.
      if (/^\[|^\[\[/.test(line.trim())) break;
      const kv = line.match(/^\s*(\w+)\s*=\s*"([^"]+)"/);
      if (kv) values[kv[1]] = kv[2];
    }
    return values;
  };

  // Take the first top-level `[[d1_databases]]` entry that binds `DB`.
  const d1 = sections.map(parseSection).find((entry) => entry.binding === "DB");
  const databaseId = d1?.database_id;
  if (!databaseId) {
    fail("No `database_id` found in the top-level `[[d1_databases]]` table.");
  }
  return databaseId;
}

function readWranglerToml(): string {
  try {
    return readFileSync(new URL("./wrangler.toml", import.meta.url), "utf8");
  } catch (error) {
    fail(
      `Could not read wrangler.toml (${error instanceof Error ? error.message : String(error)}). Run this from the project root.`,
    );
  }
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId) {
  fail("CLOUDFLARE_ACCOUNT_ID is not set.");
}
if (!apiToken) {
  fail("CLOUDFLARE_API_TOKEN is not set.");
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  driver: "d1-http",
  dbCredentials: {
    accountId,
    databaseId: readWranglerDatabaseId(),
    token: apiToken,
  },
});
