/**
 * Keyset ("seek") pagination collector.
 *
 * Callers hand a page loader that must filter `id > cursor`, order by `id`
 * ascending and limit to `pageSize`; this helper loops until a short page
 * ends the scan. Replaces OFFSET pagination, which re-scans every skipped row
 * on each page and degrades quadratically as the cursor advances. The very
 * datasets these callers read (long-running shows' episode progress) are the
 * ones where that hurts.
 *
 * The same pattern drives createDailySnapshots' user scan.
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
