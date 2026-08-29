import * as v from "valibot";

import { MEDIA_TYPES } from "@/domain/media";
import { PROGRESS_STATUSES, REACTIONS } from "@/domain/watchlist";

export const mediaTypeSchema = v.picklist([...MEDIA_TYPES]);
export { PROGRESS_STATUSES, REACTIONS };
export type MediaType = v.InferOutput<typeof mediaTypeSchema>;

// Runtime schemas derive from the domain contract so client and server use the
// same values without importing server code into the client domain.
export const progressStatusSchema = v.picklist([...PROGRESS_STATUSES]);
export type ProgressStatus = v.InferOutput<typeof progressStatusSchema>;

export const reactionSchema = v.picklist([...REACTIONS]);
export type Reaction = v.InferOutput<typeof reactionSchema>;

export const feedbackSchema = v.picklist(["like", "not_interested", "dislike"]);
export type Feedback = v.InferOutput<typeof feedbackSchema>;

export const metadataSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.maxLength(500))),
  image: v.optional(v.pipe(v.string(), v.maxLength(2048))),
  rating: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(10))),
  release_date: v.optional(v.pipe(v.string(), v.maxLength(32))),
  overview: v.optional(v.pipe(v.string(), v.maxLength(5000))),
});
export type MediaMetadata = v.InferOutput<typeof metadataSchema>;

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
