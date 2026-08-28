const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Free-tier models, tried in order by the local Gemini REST fallback only.
export const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-lite-latest",
] as const;

const GEMINI_TIMEOUT_MS = 45_000;

type ProviderErrorLike = {
  status?: number;
  message?: string;
};

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { thoughtsTokenCount?: number };
}

export interface GeminiGenerationResult {
  responseText: string;
  usedModel: string;
  highDemandError: boolean;
  rateLimited: boolean;
  locationUnsupported: boolean;
  lastError: string;
  reasoningTokens?: number;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// Gemini signals capacity issues with 503/529 and auth/quota problems with
// 429 (RESOURCE_EXHAUSTED). These classifiers intentionally stay inside the
// Gemini adapter; the public AI seam exposes only normalized error codes.
function isHighDemandError(error: unknown) {
  const candidate = error as ProviderErrorLike;
  const message = candidate.message?.toLowerCase() ?? "";
  return (
    candidate.status === 503 ||
    candidate.status === 529 ||
    message.includes("overloaded") ||
    message.includes("503") ||
    message.includes("529")
  );
}

function isRateLimitedError(error: unknown) {
  const candidate = error as ProviderErrorLike;
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
 * the request's region. It is permanent for the account, so retrying another
 * model or another attempt is pointless.
 */
function isLocationUnsupportedError(error: unknown) {
  const candidate = error as ProviderErrorLike;
  const message = candidate.message?.toLowerCase() ?? "";
  return (
    (message.includes("user location") && message.includes("not supported")) ||
    message.includes("location is not supported for the api")
  );
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequestBody(
  userPrompt: string,
  systemInstruction: string,
  responseSchema: unknown,
  disableThinking: boolean,
) {
  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
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
  responseSchema: unknown,
  disableThinking: boolean,
): Promise<Response> {
  return fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(
      buildRequestBody(
        userPrompt,
        systemInstruction,
        responseSchema,
        disableThinking,
      ),
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
  const error = new Error(message) as Error & ProviderErrorLike;
  error.status = response.status;
  return error;
}

/**
 * One non-streaming generateContent call. Some model revisions reject the
 * thinking field with a generic 400, so non-location 400s are retried once
 * without it.
 */
async function generateContent(
  apiKey: string,
  model: string,
  userPrompt: string,
  systemInstruction: string,
  responseSchema: unknown,
): Promise<{ text: string; reasoningTokens?: number }> {
  let response = await requestGeneration(
    apiKey,
    model,
    userPrompt,
    systemInstruction,
    responseSchema,
    false,
  );

  if (response.status === 400) {
    const firstError = await parseErrorResponse(response);
    if (isLocationUnsupportedError(firstError)) throw firstError;

    response = await requestGeneration(
      apiKey,
      model,
      userPrompt,
      systemInstruction,
      responseSchema,
      true,
    );
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const data = (await response.json()) as GeminiResponseBody;
  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) {
    const error = new Error(`blocked_${blockReason}`) as ProviderErrorLike;
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
    ) as ProviderErrorLike;
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
  responseSchema: unknown,
): Promise<GeminiGenerationResult> {
  let highDemandError = false;
  let rateLimited = false;
  let locationUnsupported = false;
  let lastError = "";

  for (const [index, model] of GEMINI_FALLBACK_MODELS.entries()) {
    try {
      const { text: responseText, reasoningTokens } = await generateContent(
        apiKey,
        model,
        userPrompt,
        systemInstruction,
        responseSchema,
      );
      if (responseText) {
        return {
          responseText,
          usedModel: model,
          highDemandError,
          rateLimited,
          locationUnsupported,
          lastError,
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

      if (locationUnsupported) break;
      if (index < GEMINI_FALLBACK_MODELS.length - 1) await delay(1000);
    }
  }

  return {
    responseText: "",
    usedModel: GEMINI_FALLBACK_MODELS[0],
    highDemandError,
    rateLimited,
    locationUnsupported,
    lastError,
    reasoningTokens: undefined,
  };
}

export function generateGeminiRecommendations(args: {
  apiKey: string;
  prompt: string;
  systemInstruction: string;
  responseSchema: unknown;
}): Promise<GeminiGenerationResult> {
  return generateRecommendationResponse(
    args.apiKey,
    args.prompt,
    args.systemInstruction,
    args.responseSchema,
  );
}
