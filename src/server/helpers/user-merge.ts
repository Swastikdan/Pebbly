import { eq, inArray, sql } from "drizzle-orm";

import type { AuthUser } from "../auth";
import type { Db } from "../db/client";
import { MAX_IDS_PER_IN_CLAUSE, runBatch } from "../db/client";
import {
  episodeProgress,
  homepageRecommendations,
  listItems,
  lists,
  recommendationFeedback,
  users,
  watchItems,
} from "../db/schema";

/**
 * Legacy duplicate-user consolidation, extracted from the request path.
 *
 * Historical token-identifier formats (`bare <sub>`, `<other>|<sub>`) could
 * create several `users` rows for one Clerk identity. The old inline logic in
 * `requireUser` reconciled duplicates on every sign-in (sequential candidate
 * probing plus item re-parenting inside the hot path); that work now runs as
 * the offline `user-maintenance` Nitro task instead.
 *
 * Deliberately conservative: child rows are re-parented onto the canonical
 * user, but duplicate `users` rows themselves are never deleted here — FK
 * cascades make deletion risky without product-level rules. Starving dupes
 * of writes (requireUser always picks the canonical row) is enough for them
 * to become inert.
 */

/**
 * Selects a deterministic canonical user from matching authentication records.
 *
 * @param matches - Authentication records that share the same subject.
 * @param tokenIdentifier - The preferred canonical token identifier.
 * @returns The matching user selected by token identifier, bare subject format, or lowest ID; `null` if no records match.
 */
export function pickCanonicalMatch(
  matches: AuthUser[],
  tokenIdentifier: string,
): AuthUser | null {
  if (matches.length === 0) return null;
  // Canonical current format first, then the legacy bare-<sub> format (the
  // exact subject), then a stable lowest-id pick so repeated requests always
  // land on the same row.
  return (
    matches.find((u) => u.tokenIdentifier === tokenIdentifier) ??
    matches.find((u) => !u.tokenIdentifier.includes("|")) ??
    [...matches].sort((a, b) => a.id.localeCompare(b.id))[0]
  );
}

type DuplicateGroup = { sub: string; ids: string[] };

/**
 * Finds user groups that share the same Clerk subject suffix.
 *
 * @returns Groups containing the shared subject suffix and the associated user IDs.
 */
async function findDuplicateUserGroups(db: Db): Promise<DuplicateGroup[]> {
  const rows = await db.all<{ sub: string; ids: string }>(sql`
    select substr(token_identifier, instr(token_identifier, '|') + 1) as sub,
           group_concat(id) as ids
    from users
    group by sub
    having count(*) > 1
  `);
  return rows.map((row) => ({ sub: row.sub, ids: row.ids.split(",") }));
}

export interface MergeResult {
  /** Duplicate groups found (each merged into its canonical user). */
  groups: number;
  /** Child rows re-parented or deduplicated in total. */
  rowsTouched: number;
}

/**
 * Consolidates duplicate-user data under each group's canonical user.
 *
 * @returns The number of duplicate groups found and child rows affected.
 */
export async function mergeDuplicateUsers(db: Db): Promise<MergeResult> {
  const groups = await findDuplicateUserGroups(db);
  let rowsTouched = 0;

  for (const group of groups) {
    const members = await db
      .select()
      .from(users)
      .where(inArray(users.id, group.ids));
    if (members.length < 2) continue;

    const canonical =
      pickCanonicalMatch(members, `clerk|${group.sub}`) ?? members[0];
    const dupes = members.filter((m) => m.id !== canonical.id);

    for (const dupe of dupes) {
      rowsTouched += await reparentLists(db, canonical.id, dupe.id);
      rowsTouched += await reparentWatchItems(db, canonical.id, dupe.id);
      rowsTouched += await reparentEpisodes(db, canonical.id, dupe.id);
      rowsTouched += await reparentFeedback(db, canonical.id, dupe.id);
      rowsTouched += await reparentHomepageRow(db, canonical.id, dupe.id);
    }

    console.warn(
      `[user-maintenance] consolidated group sub=${group.sub}: ` +
        `canonical=${canonical.id}, dupes=${dupes.length}`,
    );
  }

  return { groups: groups.length, rowsTouched };
}

/**
 * Moves duplicate-owned lists with unique names onto the canonical user and updates their items' ownership.
 *
 * Lists whose names conflict with the canonical user's lists remain with the duplicate user.
 *
 * @param canonicalUserId - The user who receives the movable lists.
 * @param dupeUserId - The duplicate user whose lists are consolidated.
 * @returns The number of lists moved.
 */
async function reparentLists(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalNames = new Set(
    (
      await db
        .select({ name: lists.name })
        .from(lists)
        .where(eq(lists.userId, canonicalUserId))
    ).map((r) => r.name),
  );

  const dupeLists = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(eq(lists.userId, dupeUserId));

  const movableIds = dupeLists
    .filter((list) => !canonicalNames.has(list.name))
    .map((list) => list.id);
  if (movableIds.length === 0) return 0;

  const statements: unknown[] = [];
  for (let i = 0; i < movableIds.length; i += MAX_IDS_PER_IN_CLAUSE) {
    statements.push(
      db
        .update(lists)
        .set({ userId: canonicalUserId })
        .where(
          inArray(lists.id, movableIds.slice(i, i + MAX_IDS_PER_IN_CLAUSE)),
        ),
    );
  }
  for (const listId of movableIds) {
    statements.push(
      db
        .update(listItems)
        .set({ userId: canonicalUserId })
        .where(eq(listItems.listId, listId)),
    );
  }
  await runBatch(db, statements);
  return movableIds.length;
}

/**
 * Consolidates watch items from a duplicate user into the canonical user.
 *
 * @param canonicalUserId - The user receiving unique watch items
 * @param dupeUserId - The user whose watch items are being consolidated
 * @returns The number of duplicate-user watch-item rows processed
 */
async function reparentWatchItems(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalKeys = new Set(
    (
      await db
        .select({
          tmdbId: watchItems.tmdbId,
          mediaType: watchItems.mediaType,
        })
        .from(watchItems)
        .where(eq(watchItems.userId, canonicalUserId))
    ).map((r) => `${r.tmdbId}:${r.mediaType}`),
  );

  const dupeRows = await db
    .select()
    .from(watchItems)
    .where(eq(watchItems.userId, dupeUserId));

  const statements = dupeRows.map((row) => {
    const key = `${row.tmdbId}:${row.mediaType}`;
    if (!canonicalKeys.has(key)) {
      canonicalKeys.add(key);
      return db
        .update(watchItems)
        .set({ userId: canonicalUserId })
        .where(eq(watchItems.id, row.id));
    }
    return db.delete(watchItems).where(eq(watchItems.id, row.id));
  });
  await runBatch(db, statements);
  return statements.length;
}

/**
 * Consolidates episode progress from a duplicate user under the canonical user.
 *
 * Episode progress with keys already owned by the canonical user is deleted; other records are reassigned.
 *
 * @returns The number of duplicate episode-progress records processed.
 */
async function reparentEpisodes(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalKeys = new Set(
    (
      await db
        .select({
          tmdbId: episodeProgress.tmdbId,
          season: episodeProgress.season,
          episode: episodeProgress.episode,
        })
        .from(episodeProgress)
        .where(eq(episodeProgress.userId, canonicalUserId))
    ).map((r) => `${r.tmdbId}:${r.season}:${r.episode}`),
  );

  const dupeRows = await db
    .select()
    .from(episodeProgress)
    .where(eq(episodeProgress.userId, dupeUserId));

  const statements = dupeRows.map((row) => {
    const key = `${row.tmdbId}:${row.season}:${row.episode}`;
    if (!canonicalKeys.has(key)) {
      canonicalKeys.add(key);
      return db
        .update(episodeProgress)
        .set({ userId: canonicalUserId })
        .where(eq(episodeProgress.id, row.id));
    }
    return db.delete(episodeProgress).where(eq(episodeProgress.id, row.id));
  });
  await runBatch(db, statements);
  return statements.length;
}

/**
 * Consolidates duplicate recommendation feedback records under the canonical user.
 *
 * @param canonicalUserId - The user who retains unique feedback records
 * @param dupeUserId - The duplicate user whose feedback records are consolidated
 * @returns The number of feedback records processed
 */
async function reparentFeedback(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalKeys = new Set(
    (
      await db
        .select({
          tmdbId: recommendationFeedback.tmdbId,
          mediaType: recommendationFeedback.mediaType,
        })
        .from(recommendationFeedback)
        .where(eq(recommendationFeedback.userId, canonicalUserId))
    ).map((r) => `${r.tmdbId}:${r.mediaType}`),
  );

  const dupeRows = await db
    .select()
    .from(recommendationFeedback)
    .where(eq(recommendationFeedback.userId, dupeUserId));

  const statements = dupeRows.map((row) => {
    const key = `${row.tmdbId}:${row.mediaType}`;
    if (!canonicalKeys.has(key)) {
      canonicalKeys.add(key);
      return db
        .update(recommendationFeedback)
        .set({ userId: canonicalUserId })
        .where(eq(recommendationFeedback.id, row.id));
    }
    return db
      .delete(recommendationFeedback)
      .where(eq(recommendationFeedback.id, row.id));
  });
  await runBatch(db, statements);
  return statements.length;
}

/**
 * Moves a duplicate user's homepage recommendation row to the canonical user when the canonical user has no row.
 *
 * @param canonicalUserId - The user ID that should own the recommendation row
 * @param dupeUserId - The duplicate user ID whose row may be moved
 * @returns `1` if a row was moved, `0` otherwise
 */
async function reparentHomepageRow(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const [canonicalHasRow, dupeRows] = await Promise.all([
    db
      .select({ id: homepageRecommendations.id })
      .from(homepageRecommendations)
      .where(eq(homepageRecommendations.userId, canonicalUserId))
      .limit(1),
    db
      .select({ id: homepageRecommendations.id })
      .from(homepageRecommendations)
      .where(eq(homepageRecommendations.userId, dupeUserId))
      .limit(1),
  ]);

  if (canonicalHasRow.length === 0 && dupeRows.length > 0) {
    await db
      .update(homepageRecommendations)
      .set({ userId: canonicalUserId })
      .where(eq(homepageRecommendations.id, dupeRows[0].id));
    return 1;
  }
  return 0;
}
