import { GoogleGenAI } from "@google/genai";

export interface Recommendation {
  title: string;
  tmdbId: number | null;
  mediaType: "movie" | "tv";
  relevanceScore: number;
  reasoning: string;
}

export interface GeminiResult {
  recommendations: Recommendation[];
}

export const MODELS_TO_TRY = [
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

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

export async function generateRecommendationResponse(
  ai: GoogleGenAI,
  userPrompt: string,
  systemInstruction: string,
) {
  let highDemandError = false;

  for (const [index, model] of MODELS_TO_TRY.entries()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction,
        },
      });

      const responseText = response.text ?? "";
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
  retries: number = 1
): Promise<{ result?: GeminiResult; usedModel?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in Convex environment variables");
    return { error: "api_unavailable" };
  }

  const ai = new GoogleGenAI({ apiKey });
  let responseText = "";
  let usedModel = MODELS_TO_TRY[0];
  let highDemandError = false;
  let lastError = "";
  let success = false;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await generateRecommendationResponse(ai, prompt, systemInstruction);
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
    return { error: highDemandError ? "high_demand" : (lastError || "api_unavailable") };
  }

  try {
    const parsed = JSON.parse(responseText);
    if (!parsed || !Array.isArray(parsed.recommendations)) {
      return { error: "invalid_response" };
    }
    return { result: parsed, usedModel };
  } catch {
    return { error: "invalid_response" };
  }
}
