import { getRequestHeader } from "@tanstack/react-start/server";
import { PostHog } from "posthog-node";

import { getEnv } from "@/server/env";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (posthogClient) return posthogClient;

  const appEnv = getEnv().APP_ENV;
  if (appEnv !== "preview" && appEnv !== "production") return null;

  const apiKey =
    process.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ??
    import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host =
    process.env.VITE_PUBLIC_POSTHOG_HOST ??
    import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

  if (!apiKey || !host) {
    if (import.meta.env.DEV) {
      const missingVariable = !apiKey
        ? "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN"
        : "VITE_PUBLIC_POSTHOG_HOST";
      throw new Error(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
      );
    }
    return null;
  }

  posthogClient = new PostHog(apiKey, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });

  return posthogClient;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) return;

  const sessionId = getRequestHeader("X-PostHog-Session-Id");
  posthog.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      $session_id: sessionId || undefined,
    },
  });
  await posthog.flush();
}

export async function captureServerException(
  error: unknown,
  distinctId: string,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) return;

  const sessionId = getRequestHeader("X-PostHog-Session-Id");
  await posthog.captureExceptionImmediate(error, distinctId, {
    $session_id: sessionId || undefined,
  });
}

/**
 * Record privacy-safe LLM telemetry for PostHog AI observability.
 * Prompts, watchlist contents, and model output are intentionally excluded.
 */
export async function captureAiGeneration(args: {
  distinctId: string;
  provider: string;
  model: string;
  durationMs: number;
  ok: boolean;
  error?: string;
  retries: number;
  reasoningTokens?: number;
}): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) return;

  try {
    await posthog.captureAiImmediate({
      distinctId: args.distinctId,
      event: "$ai_generation",
      properties: {
        $ai_provider: args.provider,
        $ai_model: args.model,
        $ai_is_error: !args.ok,
        $ai_latency: args.durationMs / 1000,
        generation_retries: args.retries,
        ...(args.error ? { $ai_error: args.error } : {}),
        ...(args.reasoningTokens !== undefined
          ? { reasoning_tokens: args.reasoningTokens }
          : {}),
      },
    });
  } catch (error) {
    // Observability must never turn a successful recommendation request into
    // an application failure.
    console.warn("[posthog] Failed to capture AI generation telemetry:", error);
  }
}
