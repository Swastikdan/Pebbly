/**
 * Collects all rows by repeatedly loading pages with an advancing ID cursor.
 *
 * @param pageSize - The requested maximum number of rows per page
 * @param page - Loads a page after the provided cursor, starting with `null`
 * @returns All rows retrieved across the pages
 */
export async function collectAllByKeyset<T extends { id: string }>(
  pageSize: number,
  page: (cursorId: string | null) => Promise<T[]>,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const rows = await page(cursor);
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
    cursor = rows[rows.length - 1].id;
  }
  return out;
}
