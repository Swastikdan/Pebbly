import { defineConfig } from "drizzle-kit";
import fs from "node:fs";

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
function readWranglerTomlValue(key: string): string | undefined {
	try {
		const raw = fs.readFileSync(
			new URL("./wrangler.toml", import.meta.url),
			"utf8",
		);
		const match = raw.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"));
		return match?.[1];
	} catch {
		return undefined;
	}
}

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/server/db/schema.ts",
	out: "./drizzle",
	driver: "d1-http",
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
		databaseId: readWranglerTomlValue("database_id") ?? "",
		token: process.env.CLOUDFLARE_API_TOKEN ?? "",
	},
});
