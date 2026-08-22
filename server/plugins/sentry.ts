// Bridges Nitro-handled errors to Sentry.
//
// The Worker entry (.output/server/index.sentry.mjs, see
// scripts/sentry-postbuild.mjs) wraps every handler with Sentry, but h3
// converts thrown errors into error responses instead of letting them escape,
// so the wrapper never sees most application failures. This plugin forwards
// them via captureException.
//
// Both bundles embed their own copy of the SDK at the same version, which is
// safe here: @sentry/core registers clients/scopes on a version-keyed global
// carrier (globalThis.__SENTRY__[SDK_VERSION]), so this copy resolves the
// wrapper's client and per-request isolation scope, attaching errors to the
// active request trace instead of dropping or duplicating them.
//
// Only 5xx responses are reported: 4xx are expected outcomes (bad input,
// auth, missing routes), and reporting them would burn quota on noise. When
// SENTRY_DSN is unset (local dev), captureException resolves to a no-op.
import * as Sentry from "@sentry/cloudflare";
import { definePlugin } from "nitro";

function errorStatus(error: unknown): number | undefined {
	const candidate = error as { status?: unknown; statusCode?: unknown };
	if (typeof candidate.status === "number") return candidate.status;
	if (typeof candidate.statusCode === "number") return candidate.statusCode;
	return undefined;
}

export default definePlugin((nitroApp) => {
	nitroApp.hooks.hook("error", (error, context) => {
		const status = errorStatus(error) ?? 500;
		if (status < 500) return;

		const rawUrl = context?.event?.req?.url;
		const route = rawUrl ? new URL(rawUrl, "http://localhost").pathname : undefined;
		Sentry.captureException(error, {
			mechanism: { type: "instrument", handled: true },
			captureContext: {
				tags: {
					"http.response.status_code": String(status),
					...(route ? { "nitro.route": route } : {}),
				},
			},
		});
	});
});
