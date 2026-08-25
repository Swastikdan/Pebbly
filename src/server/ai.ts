import { OpenRouter } from "@openrouter/sdk";
import * as v from "valibot";

import type { MediaType } from "@/lib/media-types";
import { getEnvVar } from "./env";

// OpenRouter is used over REST/fetched SDK. The SDK's `chat.send` streaming
// path gives access to `usage.completionTokensDetails.reasoningTokens` in the
// final chunk, which is required for reasoning-token telemetry.

export interface Recommendation {
  title: string;
  tmdbId: number | null;
  mediaType: MediaType;
  relevanceScore: number;
  reasoning: string;
}

export interface GeminiResult {
  recommendations: Recommendation[];
}

// Keep both names — callers historically imported GeminiResult / callGeminiAI.
// OpenRouterResult is the new canonical type; GeminiResult is an alias.
export type OpenRouterResult = GeminiResult;

export const MODELS_TO_TRY = ["openrouter/free"] as const;

type OpenRouterErrorLike = {
  status?: number;
  code?: number;
  message?: string;
};

/**
 * Converts an unknown error value into a message string.
 *
 * @param error - The error value to convert
 * @returns The error message or string representation of the value
 */
export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Determines whether an error indicates that the service is under high demand or overloaded.
 *
 * @param error - The error to classify
 * @returns `true` if the error indicates high demand or overload, `false` otherwise.
 */
export function isHighDemandError(error: unknown) {
  const candidate = error as OpenRouterErrorLike;
  const message = candidate.message?.toLowerCase() ?? "";

  return (
    candidate.status === 503 ||
    candidate.code === 503 ||
    candidate.status === 529 ||
    candidate.code === 529 ||
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("503") ||
    message.includes("529")
  );
}

/**
 * Determines whether an error indicates that request rate limits were exceeded.
 *
 * @param error - The error to classify
 * @returns `true` if the error indicates rate limiting, `false` otherwise.
 */
export function isRateLimitedError(error: unknown) {
  const candidate = error as OpenRouterErrorLike;
  const message = candidate.message?.toLowerCase() ?? "";
  return (
    candidate.status === 429 ||
    candidate.code === 429 ||
    message.includes("rate limit") ||
    message.includes("429")
  );
}

/**
 * Pauses execution for the specified duration.
 *
 * @param ms - The delay duration in milliseconds
 */
export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Free-tier models routed via "openrouter/free" are frequently reasoning
// models whose thinking phase alone can exceed 30s; measured SDK streams have
// taken 31s+ for small prompts. 90s leaves headroom without risking the
// Workers request budget (wall-clock waiting on fetch is not CPU time).
const OPENROUTER_TIMEOUT_MS = 90_000;

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

/**
 * Generates a JSON-formatted completion from OpenRouter.
 *
 * @param apiKey - The OpenRouter API key.
 * @param model - The model used to generate the completion.
 * @param userPrompt - The user prompt sent to the model.
 * @param systemInstruction - The system instruction sent to the model.
 * @returns The generated text and, when reported, the number of reasoning tokens used.
 * @throws An error if the provider reports a stream error or the request exceeds the timeout.
 */
async function generateContent(
  apiKey: string,
  model: string,
  userPrompt: string,
  systemInstruction: string,
): Promise<{ text: string; reasoningTokens?: number }> {
  const openrouter = new OpenRouter({
    apiKey,
  });

  // The SDK exposes streaming via `chat.send` with `chatRequest.stream === true`.
  // The response is an async iterable of ChatStreamChunk (SSE) — iterate to
  // collect delta.content and the trailing usage block.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(`OpenRouter timeout after ${OPENROUTER_TIMEOUT_MS}ms`),
        ),
      OPENROUTER_TIMEOUT_MS,
    ),
  );

  const doStream = async (): Promise<{
    text: string;
    reasoningTokens?: number;
  }> => {
    const stream = (await openrouter.chat.send({
      chatRequest: {
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
        stream: true,
        responseFormat: { type: "json_object" },
        streamOptions: { includeUsage: true },
      },
    })) as unknown as AsyncIterable<{
      choices: Array<{ delta?: { content?: string | null } }>;
      usage?: {
        completionTokensDetails?: { reasoningTokens?: number | null } | null;
      } | null;
      error?: { message?: string; code?: number } | null;
    }>;

    let text = "";
    let reasoningTokens: number | undefined;

    for await (const chunk of stream) {
      // Surface provider-side errors that appear as an `error` field on the chunk.
      if (chunk.error) {
        const err = new Error(
          chunk.error.message ?? "OpenRouter stream error",
        ) as OpenRouterErrorLike;
        err.status = chunk.error.code;
        err.code = chunk.error.code;
        throw err;
      }

      const content = chunk.choices?.[0]?.delta?.content;
      if (content) text += content;

      if (chunk.usage?.completionTokensDetails?.reasoningTokens != null) {
        reasoningTokens =
          chunk.usage.completionTokensDetails.reasoningTokens ?? undefined;
      }
    }

    if (reasoningTokens != null) {
      console.log(`[openrouter] reasoning tokens (${model}):`, reasoningTokens);
    }

    return { text, reasoningTokens };
  };

  // Race the stream against the timeout. The SDK itself also accepts
  // timeoutMs via request options, but a local race is explicit and works
  // regardless of SDK internals.
  return Promise.race([doStream(), timeout]);
}

/**
 * Generates a recommendation response using the configured models.
 *
 * @param apiKey - The API key used to access the model provider
 * @param userPrompt - The prompt containing the recommendation request
 * @param systemInstruction - Instructions that guide response generation
 * @returns The response text, model used, error classification flags, and reasoning-token usage
 */
async function generateRecommendationResponse(
  apiKey: string,
  userPrompt: string,
  systemInstruction: string,
) {
  let highDemandError = false;
  let rateLimited = false;
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
          reasoningTokens,
        };
      }
    } catch (error) {
      lastError = getErrorMessage(error);
      console.error(`OpenRouter model (${model}) error:`, lastError);
      highDemandError = highDemandError || isHighDemandError(error);
      rateLimited = rateLimited || isRateLimitedError(error);

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
    lastError,
    reasoningTokens: undefined as number | undefined,
  };
}

/**
 * Generates and validates AI recommendations using OpenRouter.
 *
 * @param prompt - The user prompt sent to the model
 * @param systemInstruction - The system instruction sent to the model
 * @param retries - The maximum number of generation attempts
 * @returns An object containing validated recommendations and model metadata, or an error code when generation or response validation fails
 */
export async function callOpenRouterAI(
  prompt: string,
  systemInstruction: string,
  retries: number = 1,
): Promise<{
  result?: OpenRouterResult;
  usedModel?: string;
  error?: string;
  reasoningTokens?: number;
}> {
  // Allow either OPENROUTER_API_KEY (new) or GEMINI_API_KEY (legacy fallback) so
  // existing deployments keep working during migration.
  const apiKey = getEnvVar("OPENROUTER_API_KEY") ?? getEnvVar("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is not set");
    return { error: "api_unavailable" };
  }

  let responseText = "";
  let usedModel = MODELS_TO_TRY[0];
  let highDemandError = false;
  let rateLimited = false;
  let reasoningTokens: number | undefined;
  let lastError = "";
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
        reasoningTokens = result.reasoningTokens;
        success = true;
        break;
      } else {
        highDemandError = highDemandError || result.highDemandError;
        rateLimited = rateLimited || result.rateLimited;
        lastError = lastError || result.lastError || "";
      }
    } catch (error) {
      lastError = getErrorMessage(error);
      if (attempt < retries) {
        await delay(1000);
      }
    }
  }
  if (!success || !responseText) {
    if (rateLimited) return { error: "rate_limited" };
    return {
      error: highDemandError ? "high_demand" : lastError || "api_unavailable",
    };
  }

  // Log reasoning tokens at the top-level call as well (useful for observability).
  if (reasoningTokens != null) {
    console.log(
      `[openrouter] callOpenRouterAI reasoningTokens:`,
      reasoningTokens,
    );
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
      result: { recommendations: validRecommendations },
      usedModel,
      reasoningTokens,
    };
  } catch {
    return { error: "invalid_response" };
  }
}

// Backwards-compatible alias — existing imports of callGeminiAI continue to work.
export const callGeminiAI = callOpenRouterAI;
