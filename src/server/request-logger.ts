import { createMiddleware } from "@tanstack/react-start";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

type DevFunctionId = { file?: string; export?: string };

function describeServerFn(pathname: string): string {
  const [, rawId = ""] = pathname.split("/").filter(Boolean);
  try {
    const base64 = `${rawId.replaceAll("-", "+").replaceAll("_", "/")}`;
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(atob(padded)) as DevFunctionId;
    if (decoded.file && decoded.export) {
      return `${decoded.file.replace(/^\//, "")}#${decoded.export}`;
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
    try {
      const result = await next();
      const status = result.response?.status ?? 0;
      const line = `${DIM}[${isServerFn ? "rpc" : "ssr"}]${RESET} ${request.method} ${CYAN}${target}${RESET} ${colorForStatus(status)}${status || "-"}${RESET} ${DIM}${durationSince(startedAt)}${RESET}`;
      if (status >= 500) console.error(line);
      else if (status >= 400) console.warn(line);
      else console.log(line);
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
