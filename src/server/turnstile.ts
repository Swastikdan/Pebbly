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

export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  if (!token) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  // Cloudflare's dummy test secret key (always passes)
  // Used in local dev when real secret key is not set
  const effectiveSecret = secretKey || "1x0000000000000000000000000000000AA";

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
