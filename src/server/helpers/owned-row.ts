import type { InferSelectModel } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { and, eq } from "drizzle-orm";

import type { Db } from "../db/client";

type OwnedTable = SQLiteTable & {
  id: AnySQLiteColumn;
  userId: AnySQLiteColumn;
};

/**
 * Load a row the user owns by primary key, or null when missing or owned by
 * someone else. Ownership belongs to the WHERE clause, so callers never have
 * to remember to scope their follow-up writes by userId.
 */
export async function findOwnedRow<Table extends OwnedTable>(
  db: Db,
  table: Table,
  userId: string,
  id: string,
): Promise<InferSelectModel<Table> | null> {
  const rows = await db
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)))
    .limit(1);
  return (rows[0] as InferSelectModel<Table> | undefined) ?? null;
}
