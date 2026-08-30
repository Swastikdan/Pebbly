import * as v from "valibot";

import type { Recommendation } from "./schema/recommendations";
import type { MediaType } from "@/domain/media";
import { normalizeTitleKey } from "@/lib/text";
import { generateGeminiRecommendations } from "./ai-gemini";
import {
  delay,
  getErrorMessage,
  HTTP_SERVER_OVERLOADED,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_TOO_MANY_REQUESTS,
} from "./ai-utils";
import { getEnv, getEnvVar } from "./env";

export type { Recommendation };

// Cloudflare Workers AI is the production provider. It is accessed through
// the native `AI` binding with JSON mode, so deployed Workers do not depend on
// Gemini's API region availability. Gemini REST remains a local-development
// fallback behind the private adapter in `ai-gemini.ts`.

const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const WORKERS_AI_TIMEOUT_MS = 30_000;

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
  reasoningTokens?: number;
}

const recommendationElementSchema = v.pipe(
  v.object({
    title: v.string(),
    tmdbId: v.union([v.number(), v.null(), v.undefined()]),
    mediaType: v.picklist(["movie", "tv"]),
    relevanceScore: v.number(),
    reasoning: v.string(),
  }),
  v.transform((value) => ({
    title: value.title,
    tmdbId: typeof value.tmdbId === "number" ? value.tmdbId : null,
    mediaType: value.mediaType,
    relevanceScore: value.relevanceScore,
    reasoning: value.reasoning,
  })),
);

// Shared JSON Schema used by both Workers AI JSON mode and the local Gemini
// fallback. Structured output helps guarantee the shape, while the Valibot
// pass below remains the final defensive validation layer.
const GEMINI_RESPONSE_SCHEMA = {
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
  json_schema: GEMINI_RESPONSE_SCHEMA,
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
  if (!ai) return { error: "api_unavailable" };

  // The Workers AI binding surfaces its own error shapes (Cloudflare error
  // codes / HTTP-style statuses), not the Gemini REST shapes the helper
  // classifiers match. Classify here so the shared Result error set
  // (rate_limited / high_demand / api_unavailable) means the same thing
  // regardless of provider (see architecture-hardening-plan item 17).
  let errorKind: "rate_limited" | "high_demand" | "api_unavailable" =
    "api_unavailable";

  const classify = (error: unknown) => {
    const err = error as { status?: number; code?: string; message?: string };
    const status = err?.status;
    const code = String(err?.code ?? "").toLowerCase();
    const message = String(err?.message ?? "").toLowerCase();
    if (
      status === HTTP_TOO_MANY_REQUESTS ||
      code.includes("rate") ||
      message.includes("rate limit")
    ) {
      return "rate_limited" as const;
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
      return "high_demand" as const;
    }
    return "api_unavailable" as const;
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
          max_tokens: 2048,
        },
        { signal: AbortSignal.timeout(WORKERS_AI_TIMEOUT_MS) },
      );
      const responseText = extractWorkersAiText(response);
      if (!responseText) throw new Error("Workers AI returned no content");

      return parseRecommendationResponse(responseText, WORKERS_AI_MODEL);
    } catch (error) {
      console.error("Workers AI error:", getErrorMessage(error));
      // Prefer the most actionable classification we have seen so far.
      const kind = classify(error);
      if (kind === "rate_limited") errorKind = "rate_limited";
      else if (kind === "high_demand" && errorKind !== "rate_limited") {
        errorKind = "high_demand";
      }
      if (attempt < retries) await delay(500);
    }
  }

  return { error: errorKind };
}

/**
 * Run the configured provider (Workers AI binding in production, Gemini REST
 * as the local fallback) and return parsed, deduplicated recommendations.
 * Provider choice, model fallback, timeouts, parsing and error classification
 * are all implementation; callers see one small interface.
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
  // Cloudflare Workers AI is the production provider. Keeping this check at
  // the shared entry point means deployed Workers never send requests to
  // Gemini, avoiding Gemini's region restriction entirely.
  if (getEnv().AI) {
    return callWorkersAI(prompt, systemInstruction, retries);
  }

  // Local Vite development has no Workers AI binding, so retain Gemini as a
  // convenient fallback when a local GEMINI_API_KEY is configured.
  const apiKey = getEnvVar("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("Neither the Workers AI binding nor GEMINI_API_KEY is set");
    return { error: "api_unavailable" };
  }

  let responseText = "";
  let usedModel = "unknown";
  let highDemandError = false;
  let rateLimited = false;
  let locationUnsupported = false;
  let reasoningTokens: number | undefined;
  let success = false;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await generateGeminiRecommendations({
        apiKey,
        prompt,
        systemInstruction,
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      });
      if (result.responseText) {
        responseText = result.responseText;
        usedModel = result.usedModel;
        highDemandError = result.highDemandError;
        rateLimited = result.rateLimited;
        locationUnsupported = result.locationUnsupported;
        reasoningTokens = result.reasoningTokens;
        success = true;
        break;
      }

      highDemandError = highDemandError || result.highDemandError;
      rateLimited = rateLimited || result.rateLimited;
      locationUnsupported = locationUnsupported || result.locationUnsupported;
    } catch (error) {
      console.error(
        "Gemini generation orchestration error:",
        getErrorMessage(error),
      );
      if (attempt < retries) await delay(1000);
    }
  }
  if (!success || !responseText) {
    // Never expose provider response text to the client. In particular, the
    // Gemini location message is actionable only as a classified error code;
    // all other unexpected provider failures stay behind a generic message.
    if (locationUnsupported) return { error: "location_unsupported" };
    if (rateLimited) return { error: "rate_limited" };
    return { error: highDemandError ? "high_demand" : "api_unavailable" };
  }

  // Log reasoning tokens at the top-level call as well (useful for observability).
  if (reasoningTokens != null) {
    console.log(
      `[ai] generateRecommendations reasoningTokens:`,
      reasoningTokens,
    );
  }

  return parseRecommendationResponse(responseText, usedModel, reasoningTokens);
}
