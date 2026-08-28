/**
 * Single source of copy for AI generation failures. Error codes come from the
 * server (`ApiResult.data.error` on generation handlers); the lookup never
 * throws and falls back to the generic "unavailable" message.
 *
 * The two surfaces that render these errors (the recommendations page and the
 * homepage rail) used to keep their own maps and grew them independently —
 * the `location_unsupported` code was added twice. Site-wide copy lives here;
 * per-surface wording passes overrides.
 */

export type GenerationErrorCode =
  | "api_unavailable"
  | "location_unsupported"
  | "invalid_response"
  | "rate_limited"
  | "high_demand"
  | "empty_watchlist";

const generationErrorMessages = {
  api_unavailable:
    "The AI service is temporarily unavailable. Please try again later.",
  location_unsupported:
    "The AI provider is not available in this region. Please try again later.",
  invalid_response: "The AI returned an unexpected response. Please try again.",
  rate_limited:
    "Please wait a couple minutes before generating new recommendations.",
  high_demand:
    "The AI model is currently experiencing high demand. Please try again later.",
  empty_watchlist:
    "Add some movies or TV shows to your watchlist first to get recommendations.",
} satisfies Record<GenerationErrorCode, string>;

export function describeGenerationError(
  code: string,
  overrides: Partial<Record<GenerationErrorCode, string>> = {},
): string {
  const messages = { ...generationErrorMessages, ...overrides };
  return messages[code as GenerationErrorCode] ?? messages.api_unavailable;
}
