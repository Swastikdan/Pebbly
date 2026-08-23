import * as v from "valibot";

import { mediaTypeSchema } from "@/lib/media-types";

export { mediaTypeSchema };
export type MediaType = v.InferOutput<typeof mediaTypeSchema>;

export const progressStatusSchema = v.picklist([
  "watch-later",
  "watching",
  "done",
  "dropped",
]);
export type ProgressStatus = v.InferOutput<typeof progressStatusSchema>;

export const reactionSchema = v.picklist([
  "loved",
  "liked",
  "mixed",
  "not-for-me",
  "recommended",
]);
export type Reaction = v.InferOutput<typeof reactionSchema>;

export const feedbackSchema = v.picklist(["like", "not_interested", "dislike"]);
export type Feedback = v.InferOutput<typeof feedbackSchema>;

export const metadataSchema = v.object({
  title: v.optional(v.string()),
  image: v.optional(v.string()),
  rating: v.optional(v.number()),
  release_date: v.optional(v.string()),
  overview: v.optional(v.string()),
});
export type MediaMetadata = v.InferOutput<typeof metadataSchema>;

// ---------------------------------------------------------------------------
// Typed error contract (replaces Convex's bare `throw new Error`)
// ---------------------------------------------------------------------------

export const errorCodeSchema = v.picklist([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
  "CONFLICT",
  "BAD_REQUEST",
]);
export type ErrorCode = v.InferOutput<typeof errorCodeSchema>;

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; code: ErrorCode; message: string };

export const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });

export const fail = (code: ErrorCode, message: string): ApiResult<never> => ({
  ok: false,
  code,
  message,
});

export class ApiError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/**
 * Unwrap a typed result on the client. Accepts the result directly or the
 * promise returned by a server fn, and throws an `ApiError` on non-ok so
 * TanStack Query's error path (and optimistic rollback) fires.
 */
export async function unwrap<T>(
  result: ApiResult<T> | Promise<ApiResult<T>>,
): Promise<T> {
  const resolved = await result;
  if (resolved.ok) return resolved.data;
  throw new ApiError(resolved.code, resolved.message);
}
