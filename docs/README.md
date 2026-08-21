# Pebbly documentation

> **Pebbly** is a full-stack movie & TV discovery app: TanStack
> Start (React 19) + Cloudflare Workers + Cloudflare D1 (SQLite) + Drizzle ORM
> + Valibot + Clerk + Google Gemini + TMDB.
>
> This documentation describes the overall architecture, every meaningful
> source file, and the architecture decisions that shaped the codebase.

## How to use these docs

| Document | What it covers |
| :--- | :--- |
| [architecture.md](./architecture.md) | The big picture: tech stack, layers, request/data flows, deployment, cron |
| [server-layer.md](./server-layer.md) | Everything server-side: Nitro, server functions, auth, RBAC, Gemini AI, watchlist snapshots |
| [client-layer.md](./client-layer.md) | Everything client-side: routing, TanStack Query, Zustand stores, the repository pattern, optimistic updates |
| [data-model.md](./data-model.md) | The D1 database: every table, index, constraint, and migration |
| [architecture-decisions.md](./architecture-decisions.md) | Architecture Decision Records (ADRs), *why* the code is shaped this way |
| [file-reference.md](./file-reference.md) | A per-file map of the repository: what each file exists for |
| [contributing.md](./contributing.md) | How to keep these docs accurate when code changes |

## Quick orientation (TL;DR)

- **One backend.** Cloudflare D1 via Drizzle ORM is the *only* database. The
  former Convex backend was fully removed (see
  [ADR-001](./architecture-decisions.md)).
- **Server functions, not REST endpoints.** All authenticated reads/writes go
  through TanStack Start `createServerFn` RPCs in `src/server/fns/`. They are
  type-safe, Valibot-validated, and co-located with the client. Nitro only owns the
  `/api/health` endpoint and the cron task.
- **A repository pattern hides remote-vs-local.** `useRepository()` picks a
  remote (server-fn + optimistic journal) or local (Zustand + localStorage)
  implementation based on auth state, so mutation hooks never branch on
  `isSignedIn`.
- **Optimistic UI with a replayable journal.** Every write is applied to the
  query cache immediately through `pending-ops.ts`, then reconciled against
  server snapshots so a stale refetch can never clobber in-flight state.
- **Clerk owns identity; the DB never stores admin status.** Admin/ban/feature
  decisions come from the signed JWT claim or the live Clerk API, never a
  stored flag that could go stale.
- **AI recommendations are gated and rate-limited.** Gemini is called over
  REST with a model fallback chain, and every generation is verified/cleaned
  before it is shown to the user.

## Repo stats (as of 2026-08-16)

- ~31,500 lines across `src/`, `server/`, `drizzle/`, and `.github/`
- ~150 source files: server fns, routes, hooks, components, lib utilities

## Also see

- [`REFACTOR_PLAN.md`](../REFACTOR_PLAN.md), the original refactoring plan
  (Convex → D1, god-hook decomposition) with its progress log.
- [`README.md`](../README.md), setup, env vars, scripts, and deployment
  instructions.
