import * as v from "valibot";

import type { MediaType } from "@/lib/media-types";
import { getEnvVar } from "./env";

// Port of `convex/ai.ts`, same retry/fallback logic, but Gemini is called over
// REST `fetch` instead of the `@google/genai` SDK (per the Cloudflare plan §6.7:
// the SDK may misbehave on the Workers runtime; the REST API is a drop-in
// replacement behind the same `callGeminiAI` signature).

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

export const MODELS_TO_TRY = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const GEMINI_REST_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiErrorLike = {
  status?: number;
  message?: string;
};

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isHighDemandError(error: unknown) {
  const candidate = error as GeminiErrorLike;
  const message = candidate.message?.toLowerCase() ?? "";

  return (
    candidate.status === 503 ||
    message.includes("high demand") ||
    message.includes("503")
  );
}

export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const GEMINI_TIMEOUT_MS = 30_000;

/**
 * Per-element schema for a Gemini recommendation. `tmdbId` is nullable, but
 * when present must be numeric; mediaType is limited to movie/tv.
 */
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

async function generateContent(
  apiKey: string,
  model: string,
  userPrompt: string,
  systemInstruction: string,
): Promise<string> {
  // Send the API key via the x-goog-api-key header (never in the URL), with
  // a per-attempt timeout so a stalled Gemini call cannot hang the Worker.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${GEMINI_REST_URL}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let message = `Gemini HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // keep the status-only message
    }
    const error = new Error(message) as GeminiErrorLike;
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text;
}

async function generateRecommendationResponse(
  apiKey: string,
  userPrompt: string,
  systemInstruction: string,
) {
  let highDemandError = false;

  for (const [index, model] of MODELS_TO_TRY.entries()) {
    try {
      const responseText = await generateContent(
        apiKey,
        model,
        userPrompt,
        systemInstruction,
      );

      if (responseText) {
        return { responseText, usedModel: model, highDemandError };
      }
    } catch (error) {
      console.error(`Gemini model (${model}) error:`, getErrorMessage(error));
      highDemandError = highDemandError || isHighDemandError(error);

      if (index < MODELS_TO_TRY.length - 1) {
        await delay(1000);
      }
    }
  }

  return { responseText: "", usedModel: MODELS_TO_TRY[0], highDemandError };
}

export async function callGeminiAI(
  prompt: string,
  systemInstruction: string,
  retries: number = 1,
): Promise<{ result?: GeminiResult; usedModel?: string; error?: string }> {
  const apiKey = getEnvVar("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    return { error: "api_unavailable" };
  }

  let responseText = "";
  let usedModel = MODELS_TO_TRY[0];
  let highDemandError = false;
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
        success = true;
        break;
      } else {
        highDemandError = highDemandError || result.highDemandError;
      }
    } catch (error) {
      lastError = getErrorMessage(error);
      if (attempt < retries) {
        await delay(1000);
      }
    }
  }

  if (!success || !responseText) {
    return {
      error: highDemandError ? "high_demand" : lastError || "api_unavailable",
    };
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

    // Validate each element with valibot (not a type cast): keep valid
    // entries, filter out anything missing the required fields.
    const validRecommendations: Recommendation[] = [];
    for (const entry of rawRecommendations) {
      const validated = v.safeParse(recommendationElementSchema, entry);
      if (validated.success) validRecommendations.push(validated.output);
    }

    return {
      result: { recommendations: validRecommendations },
      usedModel,
    };
  } catch {
    return { error: "invalid_response" };
  }
}
