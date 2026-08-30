// Shared plumbing for the AI provider adapters: `ai.ts` (Workers AI in
// production) and `ai-gemini.ts` (local REST fallback). Both classify provider
// failures into the same normalized error codes, so the low-level error
// helpers live here once.

/** Minimal shape both providers' thrown errors are inspected as. */
export type ProviderErrorLike = {
  status?: number;
  message?: string;
};

// HTTP status codes the provider error classifiers key on. 529 is the
// non-standard "server overloaded" status used by Gemini/Cloudflare.
export const HTTP_BAD_REQUEST = 400;
export const HTTP_TOO_MANY_REQUESTS = 429;
export const HTTP_SERVICE_UNAVAILABLE = 503;
export const HTTP_SERVER_OVERLOADED = 529;
export const HTTP_BAD_GATEWAY = 502;

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
