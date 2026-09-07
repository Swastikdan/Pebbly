import * as Sentry from "@sentry/cloudflare";

/**
 * Group related LLM calls into a conversation thread in Sentry Agent Monitoring.
 */
export function setSentryConversationId(conversationId: string): void {
  try {
    Sentry.setConversationId(conversationId);
  } catch (error) {
    console.debug("[sentry] Failed to set conversation ID:", error);
  }
}

/**
 * Identify the user behind each AI conversation in Sentry.
 */
export function setSentryUser(user: {
  id: string;
  email?: string | null;
  username?: string | null;
}): void {
  try {
    Sentry.setUser({
      id: user.id,
      email: user.email ?? undefined,
      username: user.username ?? undefined,
    });
  } catch (error) {
    console.debug("[sentry] Failed to set Sentry user:", error);
  }
}

/**
 * Outcome of a single AI recommendation conversation, recorded so Sentry's
 * Agent Monitoring shows what each conversation produced. The prompt / raw
 * model output are intentionally NOT included here (size + privacy); only
 * cheap diagnostic fields reach Sentry. Runs inside the authenticated
 * generation request where `setConversationId`/`setSentryUser` have already
 * scoped the conversation, so this lands on the right thread.
 */
export type AiConversationOutcome = {
  ok: boolean;
  usedModel?: string;
  recommendationCount?: number;
  reasoningTokens?: number;
  error?: string;
};

export function captureAiConversation(outcome: AiConversationOutcome): void {
  try {
    Sentry.captureEvent({
      message: `AI conversation ${outcome.ok ? "completed" : "failed"}`,
      level: outcome.ok ? "info" : "error",
      tags: {
        "ai.outcome": outcome.ok ? "success" : "failure",
        "ai.model": outcome.usedModel ?? "unknown",
      },
      extra: {
        recommendationCount: outcome.recommendationCount,
        reasoningTokens: outcome.reasoningTokens,
        error: outcome.error,
      },
    });
  } catch (error) {
    console.debug("[sentry] Failed to capture AI conversation:", error);
  }
}
