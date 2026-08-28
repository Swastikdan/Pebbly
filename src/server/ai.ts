import * as v from "valibot";

import type { MediaType } from "@/lib/media-types";
import { getEnvVar } from "./env";

// Google Gemini over REST (generativelanguage.googleapis.com). No SDK: the
// `generateContent` endpoint is a single POST, and structured output
// (`responseMimeType: "application/json"` + `responseSchema`) makes the model
// emit exactly the recommendation JSON shape. `thinkingBudget: 0` skips the
// thinking phase, which is what makes a fully synchronous in-request
// generation viable (a few seconds typical instead of the 30s+ reasoning
// phases that forced the old poll-driven job design).

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

// OpenAPI-style subset accepted by Gemini's `responseSchema`. Structured
// output guarantees the JSON shape (and the mediaType enum), so the valibot
// pass below is only a defensive net.
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
 * INVALID_ARGUMENT, so any 400 is retried once without it.
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
    // Drain the failed body before reusing the connection.
    await response.text().catch(() => "");
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
      console.error(`Gemini model (${model}) error:`, lastError);
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
  const apiKey = getEnvVar("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    return { error: "api_unavailable" };
  }

  let responseText = "";
  let usedModel: (typeof MODELS_TO_TRY)[number] = MODELS_TO_TRY[0];
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
      result: { recommendations: validRecommendations },
      usedModel,
      reasoningTokens,
    };
  } catch {
    return { error: "invalid_response" };
  }
}
