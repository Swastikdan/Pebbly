import * as v from "valibot";

import type { Recommendation } from "./schema/recommendations";
import type { MediaType } from "@/domain/media";
import { normalizeTitleKey } from "@/lib/text";
import {
  delay,
  getErrorMessage,
  HTTP_SERVER_OVERLOADED,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_TOO_MANY_REQUESTS,
} from "./ai-utils";
import { getEnv } from "./env";

export type { Recommendation };

// Cloudflare Workers AI is the recommendation provider. It is accessed through
// the native `AI` binding with JSON mode, so recommendations execute on the edge
// without depending on external API keys or third-party region restrictions.

const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const WORKERS_AI_TIMEOUT_MS = 30_000;
// A 30-title response with reasoning can exceed 2048 tokens; a truncated
// response is invalid JSON and fails the whole generation.
const WORKERS_AI_MAX_TOKENS = 4096;

type RecommendationIdentity = {
  title?: string | null;
  tmdbId?: number | null;
  mediaType: MediaType;
  relevanceScore: number;
};

/**
 * Keep one recommendation per title/media type or TMDB identity. Models can
 * repeat a title with and without a TMDB ID, so both identities are checked.
 * When duplicates differ, keep the higher-scored entry while preserving the
 * original ranking position.
 */
export function dedupeRecommendations<T extends RecommendationIdentity>(
  recommendations: T[],
): T[] {
  const result: T[] = [];
  const indexesByIdentity = new Map<string, number>();

  for (const recommendation of recommendations) {
    const mediaKey = recommendation.mediaType;
    const title = normalizeTitleKey(recommendation.title);
    const titleKey = title ? `${mediaKey}:title:${title}` : null;
    const idKey =
      typeof recommendation.tmdbId === "number"
        ? `${mediaKey}:id:${recommendation.tmdbId}`
        : null;
    const existingIndex =
      (titleKey ? indexesByIdentity.get(titleKey) : undefined) ??
      (idKey ? indexesByIdentity.get(idKey) : undefined);

    if (existingIndex === undefined) {
      const index = result.length;
      result.push(recommendation);
      if (titleKey) indexesByIdentity.set(titleKey, index);
      if (idKey) indexesByIdentity.set(idKey, index);
      continue;
    }

    // Preserve every identity alias seen for a duplicate, even when the
    // lower-scored entry is discarded. A later title with that discarded ID
    // must still be recognized as the same recommendation.
    if (titleKey) indexesByIdentity.set(titleKey, existingIndex);
    if (idKey) indexesByIdentity.set(idKey, existingIndex);

    if (recommendation.relevanceScore > result[existingIndex].relevanceScore) {
      result[existingIndex] = recommendation;
    }
  }

  return result;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
}

export interface GenerateRecommendationsResult {
  result?: RecommendationResult;
  usedModel?: string;
  error?: string;
  message?: string;
  reasoningTokens?: number;
}

const recommendationElementSchema = v.pipe(
  v.object({
    title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
    tmdbId: v.union([v.number(), v.null(), v.undefined()]),
    mediaType: v.picklist(["movie", "tv"]),
    relevanceScore: v.pipe(
      v.number(),
      v.finite(),
      v.minValue(0),
      v.maxValue(100),
    ),
    reasoning: v.pipe(v.string(), v.maxLength(2000)),
  }),
  v.transform((value) => ({
    title: value.title,
    tmdbId: typeof value.tmdbId === "number" ? value.tmdbId : null,
    mediaType: value.mediaType,
    relevanceScore: value.relevanceScore,
    reasoning: value.reasoning,
  })),
);

// Shared JSON Schema used by Workers AI JSON mode. Structured output helps
// guarantee the shape, while the Valibot pass below remains the final defensive
// validation layer.
const RECOMMENDATIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          tmdbId: { type: "number", nullable: true },
          mediaType: { type: "string", enum: ["movie", "tv"] },
          relevanceScore: { type: "number" },
          reasoning: { type: "string" },
        },
        required: [
          "title",
          "tmdbId",
          "mediaType",
          "relevanceScore",
          "reasoning",
        ],
      },
    },
  },
  required: ["recommendations"],
} as const;

type WorkersAiBinding = {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
};

const WORKERS_AI_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: RECOMMENDATIONS_JSON_SCHEMA,
};

function extractWorkersAiText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const body = response as Record<string, unknown>;

  if (typeof body.response === "string") return body.response;
  if (typeof body.text === "string") return body.text;

  const choices = body.choices;
  if (!Array.isArray(choices)) return "";
  const message = choices[0] as Record<string, unknown> | undefined;
  const messageBody = message?.message as Record<string, unknown> | undefined;
  return typeof messageBody?.content === "string" ? messageBody.content : "";
}

function parseRecommendationResponse(
  responseText: string,
  usedModel: string,
  reasoningTokens?: number,
): {
  result?: RecommendationResult;
  usedModel?: string;
  error?: string;
  reasoningTokens?: number;
} {
  try {
    const parsed = JSON.parse(responseText) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("recommendations" in parsed)
    ) {
      return { error: "invalid_response" };
    }
    const rawRecommendations = (parsed as { recommendations: unknown })
      .recommendations;
    if (!Array.isArray(rawRecommendations)) {
      return { error: "invalid_response" };
    }

    const validRecommendations: Recommendation[] = [];
    for (const entry of rawRecommendations) {
      const validated = v.safeParse(recommendationElementSchema, entry);
      if (validated.success) validRecommendations.push(validated.output);
    }

    return {
      result: { recommendations: dedupeRecommendations(validRecommendations) },
      usedModel,
      reasoningTokens,
    };
  } catch {
    return { error: "invalid_response" };
  }
}

// Least to most actionable.
const ERROR_PRIORITY = [
  "api_unavailable",
  "invalid_response",
  "high_demand",
  "rate_limited",
] as const;
type ErrorKind = (typeof ERROR_PRIORITY)[number];

class InvalidResponseError extends Error {}

async function callWorkersAI(
  prompt: string,
  systemInstruction: string,
  retries: number,
): Promise<{
  result?: RecommendationResult;
  usedModel?: string;
  error?: string;
}> {
  const ai = getEnv().AI as WorkersAiBinding | undefined;
  if (!ai) return { error: "local_unavailable" };

  // The Workers AI binding surfaces its own error shapes (Cloudflare error
  // codes / HTTP-style statuses), not the Gemini REST shapes the helper
  // classifiers match. Classify here so the shared Result error set
  // (rate_limited / high_demand / invalid_response / api_unavailable) means
  // the same thing regardless of provider (see architecture-hardening-plan
  // item 17).
  let errorKind: ErrorKind = "api_unavailable";

  const classify = (error: unknown): ErrorKind => {
    if (error instanceof InvalidResponseError) return "invalid_response";
    const err = error as { status?: number; code?: string; message?: string };
    const status = err?.status;
    const code = String(err?.code ?? "").toLowerCase();
    const message = String(err?.message ?? "").toLowerCase();
    if (
      status === HTTP_TOO_MANY_REQUESTS ||
      code.includes("rate") ||
      message.includes("rate limit")
    ) {
      return "rate_limited";
    }
    if (
      status === HTTP_SERVICE_UNAVAILABLE ||
      status === HTTP_SERVER_OVERLOADED ||
      code.includes("overload") ||
      message.includes("overload") ||
      message.includes("high demand") ||
      message.includes("busy") ||
      message.includes("capacity")
    ) {
      return "high_demand";
    }
    return "api_unavailable";
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.run(
        WORKERS_AI_MODEL,
        {
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
          response_format: WORKERS_AI_RESPONSE_FORMAT,
          temperature: 0.2,
          max_tokens: WORKERS_AI_MAX_TOKENS,
        },
        { signal: AbortSignal.timeout(WORKERS_AI_TIMEOUT_MS) },
      );
      const responseText = extractWorkersAiText(response);
      if (!responseText) throw new Error("Workers AI returned no content");

      const parsed = parseRecommendationResponse(
        responseText,
        WORKERS_AI_MODEL,
      );
      if (parsed.error) {
        throw new InvalidResponseError(
          `Workers AI returned an invalid response (${responseText.length} chars)`,
        );
      }
      return parsed;
    } catch (error) {
      console.error("Workers AI error:", getErrorMessage(error));
      // Prefer the most actionable classification we have seen so far.
      const kind = classify(error);
      if (ERROR_PRIORITY.indexOf(kind) > ERROR_PRIORITY.indexOf(errorKind)) {
        errorKind = kind;
      }
      if (attempt < retries) await delay(500);
    }
  }

  return { error: errorKind };
}

/**
 * Run Cloudflare Workers AI to generate parsed, deduplicated recommendations.
 */
export async function generateRecommendations({
  prompt,
  systemInstruction,
  retries = 1,
}: {
  prompt: string;
  systemInstruction: string;
  retries?: number;
}): Promise<GenerateRecommendationsResult> {
  if (!getEnv().AI) {
    console.error(
      "[ai] Workers AI binding is missing; AI unavailable in local dev without Workers AI binding",
    );
    return {
      error: "local_unavailable",
      message: "AI unavailable in local dev without Workers AI binding",
    };
  }

  return callWorkersAI(prompt, systemInstruction, retries);
}
