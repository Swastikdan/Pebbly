# Pebbly documentation

> **Pebbly** is a full-stack movie & TV discovery app: TanStack
> Start (React 19) + Cloudflare Workers + Cloudflare D1 (SQLite) + Drizzle ORM
>
> - Valibot + Clerk + Google Gemini + TMDB.
>
> This documentation describes the overall architecture, every meaningful
> source file, and the architecture decisions that shaped the codebase.

## How to use these docs

| Document                                                 | What it covers                                                                                              |
| :------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| [architecture.md](./architecture.md)                     | The big picture: tech stack, layers, request/data flows, deployment, cron                                   |
| [server-layer.md](./server-layer.md)                     | Everything server-side: Nitro, server functions, the `authedFn` guard pipeline, auth, RBAC, Gemini AI       |
| [client-layer.md](./client-layer.md)                     | Everything client-side: routing, TanStack Query, Zustand stores, the repository pattern, optimistic updates |
| [data-model.md](./data-model.md)                         | The D1 database: every table, index, constraint, and migration                                              |
| [architecture-decisions.md](./architecture-decisions.md) | Architecture Decision Records (ADRs), _why_ the code is shaped this way                                     |
| [file-reference.md](./file-reference.md)                 | A per-file map of the repository: what each file exists for                                                 |
| [contributing.md](./contributing.md)                     | How to keep these docs accurate when code changes                                                           |

## Quick orientation (TL;DR)

- **One backend.** Cloudflare D1 via Drizzle ORM is the _only_ database. The
  former Convex backend was fully removed (see
  [ADR-001](./architecture-decisions.md)).
- **Server functions, not REST endpoints.** All authenticated reads/writes go
  through TanStack Start `createServerFn` RPCs in `src/server/fns/`. They are
  type-safe, Valibot-validated, guarded by one shared builder (`authedFn` in
  `fns/rpc.ts`), and co-located with the client. Nitro only owns the
  `/api/health` endpoint and the cron task.
- **A repository pattern hides remote-vs-local.** `useRepository()` picks a
  remote (server-fn + optimistic journal) or local (Zustand + localStorage)
  implementation based on auth state, so mutation hooks never branch on
  `isSignedIn`. Both adapters share one decision pipeline (`status-plan.ts`)
  for progress-status writes.
- **Optimistic UI with a replayable journal.** Every write is applied to the
  query cache immediately through `lib/data/pending-ops.ts`, then reconciled
  against server snapshots so a refetch can never clobber in-flight state.
- **Clerk owns identity; the DB never stores admin status.** Admin/ban/feature
  decisions come from the signed JWT claim or the live Clerk API, never a
  stored flag that could go stale.
- **AI recommendations are gated and rate-limited.** Gemini is called over
  REST with a model fallback chain, prompts are built server-side
  (`server/prompts.ts`), and every generation is verified against TMDB before
  it is shown to the user.
- **coss ui on Base UI for the interface.** The Radix/shadcn primitive set was
  replaced by Base UI-based components with first-class light/dark/system
  themes resolved before first paint. Movie and TV routes share one
  implementation behind option factories (`lib/media-route-options.ts`).

## Repo stats (as of 2026-08-23)

- ~32,400 lines across `src/`, `server/`, `drizzle/`, and `.github/`
- ~205 source files: server fns, routes, hooks, stores, components, lib
  utilities

## Also see

- [`README.md`](../README.md), setup, env vars, scripts, and deployment
  instructions.
- [`plan/`](../plan/), working plans for in-flight refactors (historical
  context).
