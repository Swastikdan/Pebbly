import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import type { ApiResult } from "../schema/common";
import type { TasteProfile } from "../schema/taste-profile";
import { captureServerEvent } from "@/lib/posthog-server";
import { userTasteProfiles } from "../db/schema";
import { bumpAiRev } from "../helpers/watch-item";
import { ok } from "../schema/common";
import {
  DEFAULT_TASTE_PROFILE,
  updateTasteProfileArgsSchema,
} from "../schema/taste-profile";
import { authedFn, WRITE_RATE_LIMIT } from "./rpc";

export const getTasteProfile = createServerFn({ method: "POST" }).handler(() =>
  authedFn(
    { mode: "current", guest: () => ok(DEFAULT_TASTE_PROFILE) },
    undefined,
    async ({ db, user }): Promise<ApiResult<TasteProfile>> => {
      const [existing] = await db
        .select()
        .from(userTasteProfiles)
        .where(eq(userTasteProfiles.userId, user.id))
        .limit(1);

      if (!existing) {
        return ok(DEFAULT_TASTE_PROFILE);
      }

      return ok({
        adventureLevel:
          existing.adventureLevel as TasteProfile["adventureLevel"],
        preferredGenres: existing.preferredGenres ?? [],
        dislikedGenres: existing.dislikedGenres ?? [],
        dislikedThemes: existing.dislikedThemes ?? [],
        avoidTitles: existing.avoidTitles ?? [],
        preferredMediaType:
          existing.preferredMediaType as TasteProfile["preferredMediaType"],
        updatedAt: existing.updatedAt,
      });
    },
  ),
);

export const updateTasteProfile = createServerFn({ method: "POST" })
  .validator(updateTasteProfileArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ claims, db, user }): Promise<ApiResult<TasteProfile>> => {
        const now = Date.now();

        const [existing] = await db
          .select()
          .from(userTasteProfiles)
          .where(eq(userTasteProfiles.userId, user.id))
          .limit(1);

        const currentProfile: TasteProfile = existing
          ? {
              adventureLevel:
                existing.adventureLevel as TasteProfile["adventureLevel"],
              preferredGenres: existing.preferredGenres ?? [],
              dislikedGenres: existing.dislikedGenres ?? [],
              dislikedThemes: existing.dislikedThemes ?? [],
              avoidTitles: existing.avoidTitles ?? [],
              preferredMediaType:
                existing.preferredMediaType as TasteProfile["preferredMediaType"],
              updatedAt: existing.updatedAt,
            }
          : DEFAULT_TASTE_PROFILE;

        const updated: TasteProfile = {
          adventureLevel: data.adventureLevel ?? currentProfile.adventureLevel,
          preferredGenres:
            data.preferredGenres ?? currentProfile.preferredGenres,
          dislikedGenres: data.dislikedGenres ?? currentProfile.dislikedGenres,
          dislikedThemes: data.dislikedThemes ?? currentProfile.dislikedThemes,
          avoidTitles: data.avoidTitles ?? currentProfile.avoidTitles,
          preferredMediaType:
            data.preferredMediaType ?? currentProfile.preferredMediaType,
          updatedAt: now,
        };

        if (existing) {
          await db
            .update(userTasteProfiles)
            .set({
              adventureLevel: updated.adventureLevel,
              preferredGenres: updated.preferredGenres,
              dislikedGenres: updated.dislikedGenres,
              dislikedThemes: updated.dislikedThemes,
              avoidTitles: updated.avoidTitles,
              preferredMediaType: updated.preferredMediaType,
              updatedAt: now,
            })
            .where(eq(userTasteProfiles.userId, user.id));
        } else {
          await db.insert(userTasteProfiles).values({
            userId: user.id,
            adventureLevel: updated.adventureLevel,
            preferredGenres: updated.preferredGenres,
            dislikedGenres: updated.dislikedGenres,
            dislikedThemes: updated.dislikedThemes,
            avoidTitles: updated.avoidTitles,
            preferredMediaType: updated.preferredMediaType,
            updatedAt: now,
          });
        }

        await bumpAiRev(db, user.id);

        await captureServerEvent(claims.sub, "taste_profile_updated", {
          adventure_level: updated.adventureLevel,
          preferred_genres_count: updated.preferredGenres.length,
          disliked_genres_count: updated.dislikedGenres.length,
          disliked_themes_count: updated.dislikedThemes.length,
          avoid_titles_count: updated.avoidTitles.length,
          preferred_media_type: updated.preferredMediaType,
        });

        return ok(updated);
      },
    ),
  );

export const resetTasteProfile = createServerFn({ method: "POST" }).handler(
  () =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      undefined,
      async ({ claims, db, user }): Promise<ApiResult<TasteProfile>> => {
        const now = Date.now();
        const resetProfile: TasteProfile = {
          ...DEFAULT_TASTE_PROFILE,
          updatedAt: now,
        };

        const [existing] = await db
          .select()
          .from(userTasteProfiles)
          .where(eq(userTasteProfiles.userId, user.id))
          .limit(1);

        if (existing) {
          await db
            .update(userTasteProfiles)
            .set({
              adventureLevel: resetProfile.adventureLevel,
              preferredGenres: resetProfile.preferredGenres,
              dislikedGenres: resetProfile.dislikedGenres,
              dislikedThemes: resetProfile.dislikedThemes,
              avoidTitles: resetProfile.avoidTitles,
              preferredMediaType: resetProfile.preferredMediaType,
              updatedAt: now,
            })
            .where(eq(userTasteProfiles.userId, user.id));
        } else {
          await db.insert(userTasteProfiles).values({
            userId: user.id,
            ...resetProfile,
            updatedAt: now,
          });
        }

        await bumpAiRev(db, user.id);

        await captureServerEvent(claims.sub, "taste_profile_reset", {});

        return ok(resetProfile);
      },
    ),
);
