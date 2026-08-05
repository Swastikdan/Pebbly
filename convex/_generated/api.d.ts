/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as crons from "../crons.js";
import type * as custom_lists from "../custom_lists.js";
import type * as episode_progress from "../episode_progress.js";
import type * as helpers_watch_item from "../helpers/watch_item.js";
import type * as import_export from "../import_export.js";
import type * as prompts from "../prompts.js";
import type * as recommendations from "../recommendations.js";
import type * as users from "../users.js";
import type * as watchlist from "../watchlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  ai: typeof ai;
  crons: typeof crons;
  custom_lists: typeof custom_lists;
  episode_progress: typeof episode_progress;
  "helpers/watch_item": typeof helpers_watch_item;
  import_export: typeof import_export;
  prompts: typeof prompts;
  recommendations: typeof recommendations;
  users: typeof users;
  watchlist: typeof watchlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
