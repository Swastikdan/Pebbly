import { sql } from "drizzle-orm";

import type { Db } from "../db/client";

export async function ensureTable(db: Db, statements: string[]) {
  for (const ddl of statements) {
    await db.run(sql.raw(ddl));
  }
}
