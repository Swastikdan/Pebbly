import { getEnvVar } from "./env";

// Port of `convex/ai.ts` — same retry/fallback logic, but Gemini is called over
// REST `fetch` instead of the `@google/genai` SDK (per the Cloudflare plan §6.7:
// the SDK may misbehave on the Workers runtime; the REST API is a drop-in
// replacement behind the same `callGeminiAI` signature).

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

async function generateContent(
	apiKey: string,
	model: string,
	userPrompt: string,
	systemInstruction: string,
): Promise<string> {
	const response = await fetch(
		`${GEMINI_REST_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [{ parts: [{ text: userPrompt }] }],
				systemInstruction: { parts: [{ text: systemInstruction }] },
				generationConfig: { responseMimeType: "application/json" },
			}),
		},
	);

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
		if (!parsed || !Array.isArray((parsed as GeminiResult).recommendations)) {
			return { error: "invalid_response" };
		}
		return { result: parsed as GeminiResult, usedModel };
	} catch {
		return { error: "invalid_response" };
	}
}
