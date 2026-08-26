import { createMiddleware } from "@tanstack/react-start";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

/**
 * Verbose RPC tracing (incoming args + outgoing response bodies), opt-in per
 * developer via the `LOG_RPC_PAYLOADS` env var (`.env` locally, `wrangler.toml`
 * `[vars]`/secret elsewhere) and hard-gated to non-production builds. Reads
 * the same env sources as `getEnv()` (`globalThis.__env__` under Workers /
 * wrangler platform proxy, else `process.env`) without importing server-only
 * modules into the shared client/server bundle.
 */
const PAYLOAD_LOG_FLAG = "LOG_RPC_PAYLOADS";
/** Pretty-print cap for normal payloads. */
const MAX_PAYLOAD_CHARS = 6000;
/** Payloads whose compact JSON exceeds this are hidden with just the size. */
const LARGE_PAYLOAD_CHARS = 4000;

type EnvHolder = { __env__?: Record<string, unknown> };

function payloadLoggingEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  // Check both the Workers `globalThis.__env__` (populated by the
  // dev-bindings platform proxy / Nitro's cloudflare handler) and the
  // plain `process.env` populated by Nitro's dotenv loader. The proxy
  // spreads `process.env` at startup, but the flag may live in only one
  // of the two stores depending on load order, so we check both. Also
  // check `import.meta.env` for `VITE_LOG_RPC_PAYLOADS` if the flag was
  // put in `vite.config.ts` `define` or a `VITE_`-prefixed `.env` entry.
  const holder = globalThis as EnvHolder;
  const viteEnv = (import.meta as unknown as { env?: Record<string, unknown> })
    ?.env;
  const raw =
    (holder.__env__?.[PAYLOAD_LOG_FLAG] as unknown) ??
    (process.env as Record<string, unknown>)[PAYLOAD_LOG_FLAG] ??
    viteEnv?.[PAYLOAD_LOG_FLAG] ??
    viteEnv?.[`VITE_${PAYLOAD_LOG_FLAG}`];
  const value =
    typeof raw === "string"
      ? raw.trim().toLowerCase()
      : String(raw ?? "").toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function truncate(value: string): string {
  return value.length > MAX_PAYLOAD_CHARS
    ? `${value.slice(0, MAX_PAYLOAD_CHARS)}… (+${value.length - MAX_PAYLOAD_CHARS} chars hidden)`
    : value;
}

/**
 * Try to interpret a JSON-parsed value as seroval. TanStack Start uses two
 * seroval modes: `toJSONAsync` (vanilla) for client→server requests and
 * `toCrossJSONStream` (cross) for server→client responses. We try both
 * decoders; with no custom plugins simple payloads still decode, and with
 * plugins we'd need the app's seroval plugins. For logging we accept the
 * best-effort decode and fall back to the raw parsed value.
 */
async function tryDecodeSeroval(parsed: unknown): Promise<unknown | null> {
  if (!parsed || typeof parsed !== "object") return null;
  try {
    const { fromJSON, fromCrossJSON } = await import("seroval");
    // 1) Vanilla wrapper (fromJSON), used for request bodies.
    try {
      return fromJSON(parsed as never);
    } catch {
      // fall through
    }
    // 2) Cross mode (fromCrossJSON), used for response bodies, bare nodes too.
    try {
      return fromCrossJSON(
        parsed as never,
        {
          plugins: [],
          refs: new Map(),
        } as never,
      );
    } catch {
      // fall through
    }
    // 3) Bare node wrapped as vanilla, older / edge case.
    if (typeof (parsed as { t?: unknown }).t === "number") {
      try {
        return fromJSON({ t: parsed, f: 0, m: [] } as never);
      } catch {
        // fall through
      }
    }
  } catch {
    // seroval not resolvable; fall back to raw
  }
  return null;
}

async function decodeBody(raw: string): Promise<unknown> {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw.length > MAX_PAYLOAD_CHARS
      ? `${raw.slice(0, MAX_PAYLOAD_CHARS)}… (+${raw.length - MAX_PAYLOAD_CHARS} chars)`
      : raw;
  }
  const decoded = await tryDecodeSeroval(parsed);
  return decoded ?? parsed;
}

/**
 * Render a decoded value for the console. Very large payloads collapse to a
 * size line plus a bounded preview so a 500-row watchlist response doesn't
 * flood the terminal.
 */
function renderPayload(value: unknown): string {
  if (value === null) return "(no args)";
  if (typeof value === "string" && value === "(no args)") return value;
  let compact: string | undefined;
  try {
    compact = JSON.stringify(value);
  } catch {
    return String(value);
  }
  if (compact === undefined) return String(value);
  let pretty: string;
  try {
    pretty = JSON.stringify(value, null, 2) ?? compact;
  } catch {
    return truncate(compact);
  }
  if (compact.length > LARGE_PAYLOAD_CHARS) {
    return `(large payload, ${(compact.length / 1024).toFixed(1)} KB, hidden)`;
  }
  return pretty.length > MAX_PAYLOAD_CHARS
    ? `${pretty.slice(0, MAX_PAYLOAD_CHARS)}… (+${pretty.length - MAX_PAYLOAD_CHARS} chars hidden)`
    : pretty;
}

async function captureRequestPayload(request: Request): Promise<string> {
  try {
    if (request.method === "GET") {
      const payload = new URL(request.url).searchParams.get("payload");
      if (!payload) return "(no args)";
      return renderPayload(await decodeBody(payload));
    }
    const cloned = request.clone();
    const contentType = cloned.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await cloned.formData();
      return renderPayload({ formDataFields: [...form.keys()] });
    }
    const raw = await cloned.text();
    if (!raw) return "(no args)";
    return renderPayload(await decodeBody(raw));
  } catch {
    return "(unreadable)";
  }
}

async function captureResponsePayload(
  response: Response | undefined | null,
): Promise<string> {
  if (!response) return "(no response)";
  try {
    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.clone().text();
    if (!raw) return "(no content)";
    // Framed streaming responses multiplex JSON frames with binary headers;
    // reading the whole stream as text garbles it. Try to extract the first
    // JSON frame; otherwise fall back to a summary.
    if (contentType.includes("x-tss-framed")) {
      const idx = raw.indexOf('{"t"');
      if (idx !== -1) {
        const slice = raw.slice(idx);
        const end = slice.indexOf("\n");
        const jsonStr = end !== -1 ? slice.slice(0, end) : slice;
        try {
          const parsed = JSON.parse(jsonStr);
          const decoded = await tryDecodeSeroval(parsed);
          const rendered = renderPayload(decoded ?? parsed);
          return `(framed stream, first frame shown)\n${rendered}`;
        } catch {
          // fall through to raw summary
        }
      }
      return `(framed streaming response, ${raw.length} bytes, not fully decoded)`;
    }
    return renderPayload(await decodeBody(raw));
  } catch {
    return "(unreadable)";
  }
}

type DevFunctionId = { file?: string; export?: string };

function describeServerFn(pathname: string): string {
  // The dev-mode id is base64(JSON { file, export }) in the path; strip any
  // query/hash before decoding and clean compiler suffixes from the export.
  const [, rawId = ""] = pathname.split(/[?#]/)[0].split("/").filter(Boolean);
  try {
    const base64 = `${rawId.replaceAll("-", "+").replaceAll("_", "/")}`;
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(atob(padded)) as DevFunctionId;
    if (decoded.file && decoded.export) {
      const file = decoded.file.replace(/[?#].*$/, "").replace(/^\//, "");
      const name = decoded.export.replace(/_createServerFn_handler$/, "");
      return `${file}#${name}`;
    }
  } catch {
    // Fall through to the raw id below.
  }
  return rawId || pathname;
}

function colorForStatus(status: number): string {
  if (status >= 500) return RED;
  if (status >= 400) return YELLOW;
  return GREEN;
}

function durationSince(startedAt: number): string {
  return `${(performance.now() - startedAt).toFixed(1)}ms`;
}

export const requestLogger = createMiddleware({ type: "request" }).server(
  async ({ request, pathname, handlerType, next }) => {
    if (process.env.NODE_ENV === "production") return next();

    const isServerFn = handlerType === "serverFn";
    const target = isServerFn ? describeServerFn(pathname) : pathname;
    const startedAt = performance.now();
    // Payload tracing only for RPC calls; SSR bodies are whole HTML documents.
    const tracePayloads = isServerFn && payloadLoggingEnabled();
    try {
      // Clone + read before `next()`: the handler consumes the original body,
      // so a post-hoc `request.clone()` would throw.
      const requestPayload = tracePayloads
        ? await captureRequestPayload(request)
        : undefined;
      const result = await next();
      const status = result.response?.status ?? 0;
      const line = `${DIM}[${isServerFn ? "rpc" : "ssr"}]${RESET} ${request.method} ${CYAN}${target}${RESET} ${colorForStatus(status)}${status || "-"}${RESET} ${DIM}${durationSince(startedAt)}${RESET}`;
      if (tracePayloads) {
        console.log(line);
        console.log(`${DIM}  ↳ req:${RESET}`, requestPayload);
        console.log(
          `${DIM}  ↳ res:${RESET}`,
          await captureResponsePayload(result.response),
        );
      } else if (status >= 500) {
        console.error(line);
      } else if (status >= 400) {
        console.warn(line);
      } else {
        console.log(line);
      }
      return result;
    } catch (error) {
      console.error(
        `${DIM}[${isServerFn ? "rpc" : "ssr"}]${RESET} ${request.method} ${CYAN}${target}${RESET} ${RED}THREW${RESET} ${DIM}${durationSince(startedAt)}${RESET}`,
        error,
      );
      throw error;
    }
  },
);

export const serverFnLogger = createMiddleware({
  type: "function",
}).server(async ({ serverFnMeta, next }) => {
  if (process.env.NODE_ENV === "production") return next();

  const label = `${serverFnMeta.filename}#${serverFnMeta.name}`;
  const startedAt = performance.now();
  try {
    const result = await next();
    console.log(
      `${DIM}[fn]${RESET} ${CYAN}${label}${RESET} ${DIM}${durationSince(startedAt)}${RESET}`,
    );
    return result;
  } catch (error) {
    console.error(
      `${DIM}[fn]${RESET} ${CYAN}${label}${RESET} ${RED}THREW${RESET} ${DIM}${durationSince(startedAt)}${RESET}`,
      error,
    );
    throw error;
  }
});
