import * as Sentry from "@sentry/tanstackstart-react";

const REPORT_COOLDOWN_MS = 10_000;
let lastReportAt = 0;
let lastReportKey = "";

type ErrorDiagnostics = {
  errorName?: string;
  errorCode?: string;
  httpStatus?: number;
  details?: string;
};

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function classifyError(error: unknown, source: string): ErrorDiagnostics {
  const record = readRecord(error);
  const cause = readRecord(record?.cause);
  const providerError =
    readRecord(record?.error) ??
    (typeof cause?.status_code === "number" ? cause : readRecord(cause?.error));
  const status =
    readNumber(record?.status) ??
    readNumber(record?.statusCode) ??
    readNumber(cause?.status) ??
    readNumber(providerError?.status_code);
  const name =
    error instanceof Error
      ? error.name
      : typeof record?.name === "string"
        ? record.name
        : undefined;
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowerMessage = message.toLowerCase();
  const providerMessage = providerError?.status_message;
  const details =
    typeof providerMessage === "string"
      ? providerMessage
      : typeof record?.statusText === "string"
        ? record.statusText
        : undefined;

  if (source === "tmdb") {
    if (lowerMessage.includes("missing tmdb environment")) {
      return {
        errorName: name,
        errorCode: "TMDB_CONFIG_MISSING",
        details:
          "TMDB access token or API URL is missing from the client build",
      };
    }
    if (status === 401 || status === 403) {
      return {
        errorName: name,
        errorCode: "TMDB_AUTH_ERROR",
        httpStatus: status,
        details: details ?? "TMDB rejected the bearer token",
      };
    }
    if (status === 429) {
      return {
        errorName: name,
        errorCode: "TMDB_RATE_LIMITED",
        httpStatus: status,
        details,
      };
    }
    if (name === "AbortError" || lowerMessage.includes("timeout")) {
      return {
        errorName: name,
        errorCode: "TMDB_TIMEOUT",
        details: "TMDB request timed out",
      };
    }
    if (record?.issues || cause?.issues) {
      return {
        errorName: name,
        errorCode: "TMDB_RESPONSE_INVALID",
        details: "TMDB response did not match the expected schema",
      };
    }
    return {
      errorName: name,
      errorCode: "TMDB_REQUEST_FAILED",
      httpStatus: status,
      details,
    };
  }

  return { errorName: name, httpStatus: status, details };
}

/**
 * Best-effort client error reporting via Sentry.
 * Identical errors are coalesced for a short period to avoid loops.
 */
export function reportClientSideError(
  error: unknown,
  context: {
    source: string;
    componentStack?: string;
    route?: string;
    endpoint?: string;
  },
): void {
  if (typeof window === "undefined") return;

  const message =
    error instanceof Error ? error.message : String(error || "Unknown error");
  const route = context.route ?? window.location.pathname;
  const diagnostics = classifyError(error, context.source);
  const reportKey = `${context.source}|${message}|${route}|${context.endpoint ?? ""}`;
  const now = Date.now();

  if (reportKey === lastReportKey && now - lastReportAt < REPORT_COOLDOWN_MS) {
    return;
  }
  lastReportKey = reportKey;
  lastReportAt = now;

  Sentry.captureException(error, {
    tags: {
      source: context.source,
      route,
      ...(diagnostics.errorCode ? { errorCode: diagnostics.errorCode } : {}),
      ...(diagnostics.errorName ? { errorName: diagnostics.errorName } : {}),
      ...(diagnostics.httpStatus
        ? { httpStatus: String(diagnostics.httpStatus) }
        : {}),
    },
    extra: {
      details: diagnostics.details,
      endpoint: context.endpoint,
      componentStack: context.componentStack,
    },
  });
}
