import type { AuthUser, ClerkSessionClaims, RequireUserResult } from "../auth";
import type { Db } from "../db/client";
import type { RbacFeature } from "../rbac";
import type { ApiResult } from "../schema/common";
import { findUserByClaims, getSessionClaims, requireUser } from "../auth";
import { getDb } from "../db/client";
import { getEnv } from "../env";
import { consumeRateLimitBudget } from "../helpers/rate-limit";
import { hasFeature, isAdminByClaims } from "../rbac";
import { fail } from "../schema/common";

/**
 * Usage: `createServerFn` must stay written out at each site (the TanStack
 * Start compiler statically extracts the literal `.handler(fn)` argument to
 * build the RPC endpoint), so `authedFn` produces the awaited handler result:
 *
 * ```ts
 * export const updateProgress = createServerFn({ method: "POST" })
 *   .validator(updateProgressArgsSchema)
 *   .handler(({ data }) =>
 *     authedFn({ mode: "require" }, data, async ({ user, db }) => {
 *       ...
 *       return ok({ ok: true });
 *     }),
 *   );
 * ```
 *
 * It resolves the session, applies the configured gates in order
 * (authentication → feature → admin), injects `getDb(getEnv())`, and returns
 * an `ApiResult` envelope instead of throwing.
 */

export type AuthMode =
  | "require"
  /** Resolve without creating; unauthenticated requests get `guest`. */
  | "current"
  /** Like "current" but the handler also runs for anonymous visitors. */
  | "anonymous";

export interface AuthedFnConfig {
  readonly mode?: AuthMode;
  /**
   * Response for requests that never reach the handler:
   * anonymous callers in `"current"` mode, or (in `"require"` mode) the
   * `UNAUTHORIZED` error override, e.g. `getUserFeaturesFn` answering
   * ok-with-defaults instead of `UNAUTHORIZED`.
   */
  readonly guest?: () => ApiResult<unknown>;
  readonly feature?: RbacFeature;
  readonly featureDenied?: "fail" | "guest";
  readonly admin?: boolean;
  /**
   * Per-user write budget for mutating fns. Enforced inside `authedFn`
   * after the auth gates pass, against one shared bucket per user
   * (`fnw:<user.id>`) across every fn that opts in — so the budget bounds
   * a user's TOTAL write rate, not per-fn rates. Read fns must not set it.
   * The consumed slot is never released (failed writes keep counting, so a
   * retry loop cannot hammer the DB), which is why the expensive AI
   * generation fns keep their own releasing cooldown instead.
   */
  readonly rateLimit?: { readonly windowMs: number; readonly max: number };
}

/**
 * Default write budget for mutating server fns: a shared 120
 * writes/minute/user across every fn that opts in (`rateLimit:
 * WRITE_RATE_LIMIT`). Deliberately generous — it caps D1 write-cost abuse,
 * it does not throttle real usage (the client's batcher coalesces
 * optimistic ops, so realistic write rates are far below this).
 */
export const WRITE_RATE_LIMIT = { windowMs: 60_000, max: 120 } as const;

type ModeOf<C> = C extends {
  readonly mode: infer M extends AuthMode;
}
  ? M
  : "require";

type UserFor<M extends AuthMode> = M extends "anonymous"
  ? AuthUser | null
  : AuthUser;

type ClaimsFor<M extends AuthMode> = M extends "require"
  ? ClerkSessionClaims
  : ClerkSessionClaims | null;

export interface AuthedContext<TData, TUser, TClaims> {
  data: TData;
  user: TUser;
  claims: TClaims;
  db: Db;
}

export type AuthedHandler<C extends AuthedFnConfig, TData, TResult> = (
  context: AuthedContext<TData, UserFor<ModeOf<C>>, ClaimsFor<ModeOf<C>>>,
) => TResult | Promise<TResult>;

/**
 * Executes `handler` behind the configured auth gates. Called from inside
 * `.handler(({ data }) => ...)`; the validated `data` must be forwarded as the
 * second argument. Returns the envelope promise, never a closure, so the
 * result stays serializable across the TanStack RPC boundary.
 */
export function authedFn<TData, C extends AuthedFnConfig, TResult>(
  config: C,
  data: TData,
  handler: AuthedHandler<C, TData, TResult>,
): Promise<TResult> {
  return (async () => {
    const resolved = await resolveAuth(config);
    if (resolved.kind === "fallback") {
      return resolved.response as TResult;
    }
    if (resolved.kind === "unauthorized") {
      return resolved.error as TResult;
    }

    const { user, claims } = resolved;

    if (config.feature && !(await hasFeature(claims, user, config.feature))) {
      if ((config.featureDenied ?? "fail") === "guest" && config.guest) {
        return config.guest() as TResult;
      }
      return fail("FORBIDDEN", "Unauthorized: feature not enabled") as TResult;
    }

    if (config.admin === true) {
      // JWT-claim-only: the signed claim is the sole request-path source for
      // admin decisions (a live Clerk API fallback here would put an external
      // call inside every admin gate). Requires the Clerk session-claims
      // template to embed `publicMetadata.isAdmin`. See isAdminByClaims.
      // A revoked admin claim stops working when the short-lived session
      // token expires and refreshes (verifyToken enforces `exp`); same
      // bounded-staleness contract as hasFeature/getUserFeatures in rbac.ts.
      const isAdmin = claims ? isAdminByClaims(claims) : false;
      if (!isAdmin) {
        return fail("FORBIDDEN", "Forbidden: admin access required") as TResult;
      }
    }

    if (config.rateLimit && user) {
      const reservation = await consumeRateLimitBudget(
        getDb(getEnv()),
        `fnw:${user.id}`,
        config.rateLimit.windowMs,
        config.rateLimit.max,
      );
      if (!reservation.allowed) {
        return fail(
          "RATE_LIMITED",
          "Too many requests. Please slow down and try again shortly.",
        ) as TResult;
      }
    }

    return handler({
      data,
      user: user as UserFor<ModeOf<C>>,
      claims: claims as ClaimsFor<ModeOf<C>>,
      db: getDb(getEnv()),
    }) as Promise<TResult>;
  })();
}

type UnauthorizedError = RequireUserResult["error"];

type ResolvedAuth =
  | { kind: "authenticated"; user: AuthUser; claims: ClerkSessionClaims }
  | {
      kind: "anonymous";
      user: AuthUser | null;
      claims: ClerkSessionClaims | null;
    }
  | { kind: "fallback"; response: ApiResult<unknown> }
  | { kind: "unauthorized"; error: UnauthorizedError };

async function resolveAuth(config: AuthedFnConfig): Promise<ResolvedAuth> {
  if (config.mode === "current" || config.mode === "anonymous") {
    const claims = await getSessionClaims();
    const user = claims ? await findUserByClaims(claims) : null;
    if (!user) {
      if (config.mode === "current") {
        if (!config.guest) {
          throw new Error(
            'authedFn mode "current" requires a `guest` fallback.',
          );
        }
        return { kind: "fallback", response: config.guest() };
      }
      return { kind: "anonymous", user: null, claims: null };
    }
    return {
      kind: "authenticated",
      user,
      claims: claims as ClerkSessionClaims,
    };
  }

  const result = await requireUser();
  if (result.error) {
    if (config.guest) return { kind: "fallback", response: config.guest() };
    return { kind: "unauthorized", error: result.error };
  }
  return { kind: "authenticated", user: result.user, claims: result.claims };
}
