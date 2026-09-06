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
