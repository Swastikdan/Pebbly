# Contributing to Pebbly

First off, thanks for taking the time to contribute!

Pebbly is a full-stack movie & TV discovery app built with TanStack Start,
Cloudflare Workers, D1 (SQLite), Drizzle ORM, and TMDB metadata. This guide
covers how to set up the project, what to know before you start, and how to get
your changes merged.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Development workflow](#development-workflow)
- [Code style & checks](#code-style--checks)
- [Testing](#testing)
- [Documentation](#documentation)
- [Opening a pull request](#opening-a-pull-request)

## Code of conduct

This project and everyone participating in it is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to
uphold this code. Please report unacceptable behavior to the maintainers.

## Getting started

### Prerequisites

- **Node.js 22+** and **pnpm 10+**
- A **TMDB API Read Access Token** (free at [themoviedb.org](https://www.themoviedb.org/signup))
- A **Clerk application** (for auth)
- A **Google Gemini API key** (for AI recommendations)
- (Optional) A **Cloudflare account** with a D1 database for local `wrangler` dev

### Setup

1. **Clone and install**

   ```bash
   git clone https://github.com/Swastikdan/Pebbly.git
   cd Pebbly
   pnpm install
   ```

2. **Configure environment variables**

   Copy the template and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

   At minimum you need:

   ```env
   VITE_PUBLIC_TMDB_ACCESS_TOKEN=your_tmdb_read_access_token
   VITE_PUBLIC_TMDB_API_URL=https://api.themoviedb.org/3
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_ISSUER_URL=https://your-app.clerk.accounts.dev
   VITE_PUBLIC_APP_URL=http://localhost:3000
   GEMINI_API_KEY=your_gemini_key
   ```

3. **Initialize the local database**

   ```bash
   pnpm db:migrate:local
   ```

4. **Run the dev server**

   ```bash
   pnpm dev
   ```

   The app runs at `http://localhost:3000`.

## Project structure

A quick map of where things live:

| Path              | Purpose                                                               |
| :---------------- | :-------------------------------------------------------------------- |
| `src/routes/`     | TanStack Router file-based routes (movie/tv/person/search pages)      |
| `src/server/`     | Server functions, D1 schema, auth, RBAC, AI engine                    |
| `src/components/` | UI components & domain widgets (media cards, watchlist, player)       |
| `src/hooks/`      | Custom hooks (watchlist, watch progress, daily pick, recommendations) |
| `src/lib/`        | Queries, schemas, repository pattern, utils, query keys               |
| `drizzle/`        | Generated SQL migrations for Cloudflare D1                            |
| `server/`         | Nitro server routes & scheduled tasks                                 |

See [docs/](docs/README.md) for in-depth architecture docs, especially
[`docs/architecture.md`](docs/architecture.md) and
[`docs/file-reference.md`](docs/file-reference.md).

## Development workflow

1. **Find or create an issue** and comment that you're working on it so others
   don't duplicate your work.
2. **Create a feature branch** off `main`:

   ```bash
   git checkout -b feat/my-change
   ```

   Use a descriptive prefix: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`.

3. **Make your changes**, keeping them focused and as small as possible.
4. **Run the checks** below before pushing.
5. **Open a pull request**, see [Opening a pull request](#opening-a-pull-request).

## Code style & checks

Always run these before pushing:

```bash
pnpm typecheck   # TypeScript strict type checking
pnpm lint        # Biome lint
pnpm build       # Production build
```

- The project uses **Biome** for linting and formatting. If your editor doesn't
  pick it up automatically, run `pnpm format` before committing.
- Prefer **existing project conventions** over introducing new ones. Match the
  style of the code around your change.
- **Don't add new dependencies** unless they're clearly necessary. If you do,
  explain why in the PR description.
- Keep server functions **type-safe and validated** with the existing Valibot
  schemas in `src/server/schema/`.

## Testing

There is no formal test suite yet. If your change touches data fetching, state
management, or the repository layer, verify manually:

- Run the app locally with `pnpm dev` and exercise the affected flows.
- If you changed DB behavior, run `pnpm db:migrate:local` to apply the latest
  migrations and check with `pnpm db:studio`.

## Documentation

- The `docs/` folder is the source of truth for architecture. If you change
  routes, server functions, the DB schema, or the repository layer, update the
  relevant docs (see [`docs/contributing.md`](docs/contributing.md)).
- Keep README badges, tech-stack tables, and feature lists in sync with reality.

## Opening a pull request

1. Push your branch and open a PR against `main`.
2. Fill out the [pull request template](.github/pull_request_template.md).
3. Reference the issue(s) your PR closes (e.g. `Closes #123`).
4. Keep the PR focused: one logical change per PR. Split large changes.
5. CI runs typecheck, lint, and build on every PR, so make sure they pass.

Thanks again for contributing!
