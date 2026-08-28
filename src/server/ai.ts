import * as v from "valibot";

import type { MediaType } from "@/lib/media-types";
import { normalizeTitleKey } from "@/lib/text";
import { getEnv, getEnvVar } from "./env";

// Cloudflare Workers AI is the production provider. It is accessed through
// the native `AI` binding with JSON mode, so deployed Workers do not depend on
// Gemini's API region availability. Gemini REST remains as a local-development
// fallback when no Workers AI binding is present.

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Free-tier models, tried in order: 2.5 Flash for quality, the
// flash-lite-latest alias as a faster fallback (the pinned
// `gemini-2.5-flash-lite` is no longer available to new API projects). Each
// free tier allows ~10 RPM / ~250 RPD, which pairs safely with the app's
// per-user generation rate limit.
export const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-flash-lite-latest",
] as const;

// A non-thinking structured request normally completes in under 10s; 45s
// covers tail latency without approaching Workers request budgets (wall-clock
// waiting on fetch is not CPU time).
const GEMINI_TIMEOUT_MS = 45_000;
const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const WORKERS_AI_TIMEOUT_MS = 30_000;

export interface Recommendation {
  title: string;
  tmdbId: number | null;
  mediaType: MediaType;
  relevanceScore: number;
  reasoning: string;
}

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

export interface GeminiResult {
  recommendations: Recommendation[];
}

type GeminiErrorLike = {
  status?: number;
  message?: string;
};

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// Gemini signals capacity issues with 503 ("The model is overloaded") and
// auth/quota problems with 429 (RESOURCE_EXHAUSTED).
export function isHighDemandError(error: unknown) {
  const candidate = error as GeminiErrorLike;
  const message = candidate.message?.toLowerCase() ?? "";

  return (
    candidate.status === 503 ||
    candidate.status === 529 ||
    message.includes("overloaded") ||
    message.includes("503") ||
    message.includes("529")
  );
}

export function isRateLimitedError(error: unknown) {
  const candidate = error as GeminiErrorLike;
  const message = candidate.message?.toLowerCase() ?? "";
  return (
    candidate.status === 429 ||
    message.includes("rate limit") ||
    message.includes("resource_exhausted") ||
    message.includes("quota") ||
    message.includes("429")
  );
}

/**
 * Gemini returns this as a 400 when the API key/account cannot be used from
 * the request's region. It is a configuration/provider restriction, not a
 * transient model failure, so trying other models or retrying is pointless.
 */
export function isLocationUnsupportedError(error: unknown) {
  const candidate = error as GeminiErrorLike;
  const message = candidate.message?.toLowerCase() ?? "";
  return (
    (message.includes("user location") && message.includes("not supported")) ||
    message.includes("location is not supported for the api")
  );
}

export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { thoughtsTokenCount?: number };
}

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
): {
  result?: GeminiResult;
  usedModel?: string;
  error?: string;
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
  result?: GeminiResult;
  usedModel?: string;
  error?: string;
}> {
  const ai = getEnv().AI as WorkersAiBinding | undefined;
  if (!ai) return { error: "api_unavailable" };

  let rateLimited = false;
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
      rateLimited = rateLimited || isRateLimitedError(error);
      if (attempt < retries) await delay(500);
    }
  }

  return { error: rateLimited ? "rate_limited" : "api_unavailable" };
}

function buildRequestBody(
  userPrompt: string,
  systemInstruction: string,
  disableThinking: boolean,
) {
  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      // Disabling thinking keeps synchronous generations in the 2-6s range.
      ...(disableThinking ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
    },
  };
}

async function requestGeneration(
  apiKey: string,
  model: string,
  userPrompt: string,
  systemInstruction: string,
  disableThinking: boolean,
): Promise<Response> {
  return fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(
      buildRequestBody(userPrompt, systemInstruction, disableThinking),
    ),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
}

async function parseErrorResponse(response: Response): Promise<Error> {
  const raw = await response.text().catch(() => "");
  let message = `Gemini HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) message = parsed.error.message;
  } catch {
    // Non-JSON error body; keep the generic message.
  }
  const error = new Error(message) as Error & GeminiErrorLike;
  error.status = response.status;
  return error;
}

/**
 * One non-streaming generateContent call. `thinkingConfig` (thinking disabled)
 * is sent first; some model revisions reject the field with a generic 400
 * INVALID_ARGUMENT, so non-location 400s are retried once without it.
 */
async function generateContent(
  apiKey: string,
  model: string,
  userPrompt: string,
  systemInstruction: string,
): Promise<{ text: string; reasoningTokens?: number }> {
  let response = await requestGeneration(
    apiKey,
    model,
    userPrompt,
    systemInstruction,
    false,
  );

  if (response.status === 400) {
    // Parse the failed body before retrying. A location restriction is a
    // permanent account/provider configuration error, so retrying the same
    // request without thinking would only add latency.
    const firstError = await parseErrorResponse(response);
    if (isLocationUnsupportedError(firstError)) throw firstError;

    response = await requestGeneration(
      apiKey,
      model,
      userPrompt,
      systemInstruction,
      true,
    );
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const data = (await response.json()) as GeminiResponseBody;

  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) {
    const error = new Error(`blocked_${blockReason}`) as GeminiErrorLike;
    error.status = 400;
    throw error;
  }

  const finishReason = data.candidates?.[0]?.finishReason;
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");

  if (!text) {
    const error = new Error(
      `Gemini returned no content (finishReason: ${finishReason ?? "unknown"})`,
    ) as GeminiErrorLike;
    error.status = 502;
    throw error;
  }

  const reasoningTokens = data.usageMetadata?.thoughtsTokenCount;
  return {
    text,
    reasoningTokens:
      typeof reasoningTokens === "number" ? reasoningTokens : undefined,
  };
}

async function generateRecommendationResponse(
  apiKey: string,
  userPrompt: string,
  systemInstruction: string,
) {
  let highDemandError = false;
  let rateLimited = false;
  let locationUnsupported = false;
  let lastError = "";

  for (const [index, model] of MODELS_TO_TRY.entries()) {
    try {
      const { text: responseText, reasoningTokens } = await generateContent(
        apiKey,
        model,
        userPrompt,
        systemInstruction,
      );

      if (responseText) {
        return {
          responseText,
          usedModel: model,
          highDemandError,
          rateLimited,
          locationUnsupported,
          reasoningTokens,
        };
      }
    } catch (error) {
      lastError = getErrorMessage(error);
      console.error(`Gemini model (${model}) error:`, lastError);
      highDemandError = highDemandError || isHighDemandError(error);
      rateLimited = rateLimited || isRateLimitedError(error);
      locationUnsupported =
        locationUnsupported || isLocationUnsupportedError(error);

      // Location restrictions are permanent for this API key/account and do
      // not benefit from another model or another attempt.
      if (locationUnsupported) break;

      if (index < MODELS_TO_TRY.length - 1) {
        await delay(1000);
      }
    }
  }

  return {
    responseText: "",
    usedModel: MODELS_TO_TRY[0],
    highDemandError,
    rateLimited,
    locationUnsupported,
    lastError,
    reasoningTokens: undefined as number | undefined,
  };
}

export async function callGeminiAI(
  prompt: string,
  systemInstruction: string,
  retries: number = 1,
): Promise<{
  result?: GeminiResult;
  usedModel?: string;
  error?: string;
  reasoningTokens?: number;
}> {
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
  let usedModel: (typeof MODELS_TO_TRY)[number] = MODELS_TO_TRY[0];
  let highDemandError = false;
  let rateLimited = false;
  let locationUnsupported = false;
  let reasoningTokens: number | undefined;
  let success = false;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await generateRecommendationResponse(
        apiKey,
        prompt,
        systemInstruction,
      );
      if (result.responseText) {
        responseText = result.responseText;
        usedModel = result.usedModel;
        highDemandError = result.highDemandError;
        rateLimited = result.rateLimited;
        locationUnsupported = result.locationUnsupported;
        reasoningTokens = result.reasoningTokens;
        success = true;
        break;
      } else {
        highDemandError = highDemandError || result.highDemandError;
        rateLimited = rateLimited || result.rateLimited;
        locationUnsupported = locationUnsupported || result.locationUnsupported;
      }
    } catch (error) {
      console.error(
        "Gemini generation orchestration error:",
        getErrorMessage(error),
      );
      locationUnsupported =
        locationUnsupported || isLocationUnsupportedError(error);
      if (attempt < retries && !locationUnsupported) {
        await delay(1000);
      }
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
    console.log(`[gemini] callGeminiAI reasoningTokens:`, reasoningTokens);
  }

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
