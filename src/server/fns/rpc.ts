import type { GenericSchema, InferOutput } from "valibot";

import type { AuthUser, ClerkSessionClaims, RequireUserResult } from "../auth";
import type { Db } from "../db/client";
import type { RbacFeature } from "../rbac";
import type { ApiResult } from "../schema/common";
import {
  findUserByClaims,
  getSessionClaims,
  isAdminFromClerkApi,
  requireUser,
} from "../auth";
import { getDb } from "../db/client";
import { getEnv } from "../env";
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

type RpcSchema = GenericSchema<unknown, unknown>;

export interface AuthedFnConfig {
  readonly schema?: RpcSchema;
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
}

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

type DataOf<C> = C extends { readonly schema: infer S }
  ? S extends RpcSchema
    ? InferOutput<S>
    : unknown
  : undefined;

export interface AuthedContext<TData, TUser, TClaims> {
  data: TData;
  user: TUser;
  claims: TClaims;
  db: Db;
}

export type AuthedHandler<C extends AuthedFnConfig, TResult> = (
  context: AuthedContext<DataOf<C>, UserFor<ModeOf<C>>, ClaimsFor<ModeOf<C>>>,
) => TResult | Promise<TResult>;

/**
 * Executes `handler` behind the configured auth gates. Called from inside
 * `.handler(({ data }) => ...)`; the validated `data` must be forwarded as the
 * second argument. Returns the envelope promise, never a closure, so the
 * result stays serializable across the TanStack RPC boundary.
 */
export function authedFn<C extends AuthedFnConfig, TResult>(
  config: C,
  data: unknown,
  handler: AuthedHandler<C, TResult>,
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
      const isAdmin = claims
        ? isAdminByClaims(claims) || (await isAdminFromClerkApi(claims.sub))
        : false;
      if (!isAdmin) {
        return fail("FORBIDDEN", "Forbidden: admin access required") as TResult;
      }
    }

    return handler({
      data: data as DataOf<C>,
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

export function guestFallback<T>(value: T | (() => T)): () => T {
  return typeof value === "function" ? (value as () => T) : () => value;
}

export type RequiredAuthResult =
  | { ok: true; user: AuthUser; claims: ClerkSessionClaims; db: Db }
  | { ok: false; error: UnauthorizedError };

export async function resolveRequiredAuth(): Promise<RequiredAuthResult> {
  const result = await requireUser();
  if (result.error) return { ok: false, error: result.error };
  return {
    ok: true,
    user: result.user,
    claims: result.claims,
    db: getDb(getEnv()),
  };
}
