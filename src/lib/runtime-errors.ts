/**
 * The Workers runtime (workerd) aborts a response body stream that stays open
 * past its lifetime limit. That is a transport-level teardown, not an
 * application failure, so the server entry logs it without capturing it.
 */
export function isStreamLifetimeAbort(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("Stream lifetime exceeded")
  );
}
