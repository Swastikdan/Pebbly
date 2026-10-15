/**
 * Server-side verification for Cloudflare Turnstile tokens.
 * Calls Cloudflare's siteverify API endpoint.
 */
export interface TurnstileVerifyResult {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  errorCodes?: string[];
  action?: string;
  cdata?: string;
}

/** Cloudflare's dummy test secret key (always passes). Dev/test only. */
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";
/** Bound the Siteverify round trip so a stalled request fails fast. */
const SITEVERIFY_TIMEOUT_MS = 10_000;

/**
 * True only in an explicit development/test environment. The always-pass test
 * credential must never be reachable in production.
 */
function isDevOrTestEnv(): boolean {
  if (import.meta.env.DEV === true || import.meta.env.MODE === "test") {
    return true;
  }
  return typeof process !== "undefined" && process.env?.NODE_ENV === "test";
}

export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  if (!token) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  // Reject an empty secret in production instead of silently falling back to
  // Cloudflare's passing test secret. The test credential is permitted only
  // when a development/test environment is explicitly active.
  const effectiveSecret =
    secretKey || (isDevOrTestEnv() ? TEST_SECRET_KEY : "");
  if (!effectiveSecret) {
    return { success: false, errorCodes: ["missing-input-secret"] };
  }

  try {
    const formData = new FormData();
    formData.append("secret", effectiveSecret);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      return {
        success: false,
        errorCodes: [`http_${response.status}`],
      };
    }

    const data = (await response.json()) as {
      success: boolean;
      challenge_ts?: string;
      hostname?: string;
      "error-codes"?: string[];
      action?: string;
      cdata?: string;
    };

    return {
      success: Boolean(data.success),
      challenge_ts: data.challenge_ts,
      hostname: data.hostname,
      errorCodes: data["error-codes"],
      action: data.action,
      cdata: data.cdata,
    };
  } catch (error) {
    return {
      success: false,
      errorCodes: [error instanceof Error ? error.message : "network_failure"],
    };
  }
}
