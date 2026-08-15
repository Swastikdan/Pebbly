import { z } from "zod";

export const mediaTypeSchema = z.enum(["movie", "tv"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

export const progressStatusSchema = z.enum([
	"watch-later",
	"watching",
	"done",
	"dropped",
]);
export type ProgressStatus = z.infer<typeof progressStatusSchema>;

export const reactionSchema = z.enum([
	"loved",
	"liked",
	"mixed",
	"not-for-me",
	"recommended",
]);
export type Reaction = z.infer<typeof reactionSchema>;

export const feedbackSchema = z.enum(["like", "not_interested", "dislike"]);
export type Feedback = z.infer<typeof feedbackSchema>;

export const metadataSchema = z.object({
	title: z.string().optional(),
	image: z.string().optional(),
	rating: z.number().optional(),
	release_date: z.string().optional(),
	overview: z.string().optional(),
});
export type MediaMetadata = z.infer<typeof metadataSchema>;

// ---------------------------------------------------------------------------
// Typed error contract (replaces Convex's bare `throw new Error`)
// ---------------------------------------------------------------------------

export const errorCodeSchema = z.enum([
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"RATE_LIMITED",
	"CONFLICT",
	"BAD_REQUEST",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export type ApiResult<T> =
	| { ok: true; data: T }
	| { ok: false; code: ErrorCode; message: string };

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
