import { eq, inArray, sql } from "drizzle-orm";

import type { AuthUser } from "../auth";
import type { Db } from "../db/client";
import { runBatch } from "../db/client";
import {
  episodeProgress,
  homepageRecommendations,
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
 * user, but duplicate `users` rows themselves are never deleted here — list
 * name collisions and FK cascades make deletion risky without product-level
 * rules. Starving dupes of writes (requireUser always picks the canonical
 * row) is enough for them to become inert.
 */

/**
 * Deterministic canonical-row choice shared by `requireUser`: prefer the
 * canonical `clerk|<sub>` token format, then the lowest id. Pure — no DB
 * probing — so the hot path stays O(matches).
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
 * Find groups of users sharing one Clerk subject (the text after the last
 * `|`). One aggregate query; empty result means nothing to do, which keeps a
 * daily schedule harmless.
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
 * Re-parent watch/episode/feedback/homepage rows from every duplicate user
 * onto the group's canonical user. Rows whose natural key already exists on
 * the canonical side are deleted rather than moved (the unique index would
 * reject the move anyway).
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

/** Move one (userId-scoped) domain of rows, deleting natural-key duplicates. */
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
 * homepage_recommendations is unique per user: move the dupe's row only when
 * the canonical user has none (otherwise the canonical row wins and the
 * dupe's row dies with the dupe's other leftovers).
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
