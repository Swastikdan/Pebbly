# Pebbly

Pebbly is a full-stack movie and TV show discovery app built with TanStack Start, Cloudflare Workers, D1 (SQLite), Drizzle ORM, Valibot, Clerk, Google Gemini, and TMDB metadata. It has media browsing, persistent watchlists, per-episode progress tracking, custom lists, and AI recommendations based on what you watch.

---

## Documentation

In-depth architecture docs live in the [`docs/`](./docs/) folder:

| Document | Covers |
| :--- | :--- |
| [Architecture](./docs/architecture.md) | Tech stack, layers, request flows, deployment & CI |
| [Server Layer](./docs/server-layer.md) | Nitro, server functions, auth, RBAC, AI engine |
| [Client Layer](./docs/client-layer.md) | Routing, data fetching, state, repository pattern, optimistic updates |
| [Data Model](./docs/data-model.md) | Every D1 table, index, constraint & migration |
| [Architecture Decisions](./docs/architecture-decisions.md) | ADRs, why the code is shaped the way it is |
| [File Reference](./docs/file-reference.md) | A per-file map of the entire repository |
| [Contributing](./docs/contributing.md) | How to keep the docs accurate as the code changes |

---

## Key features

### Media discovery and watchlist
- Browse trending, popular, top-rated, upcoming, and curated movie/TV collections.
- Cross-media search with genre, media type, and keyword filters.
- Detail pages with cast/crew info, trailers, season/episode browsers, and an embedded video player.
- Watchlist statuses (`watch-later`, `watching`, `done`, `dropped`), per-episode progress, and reaction tags (`loved`, `liked`, `mixed`, `not-for-me`, `recommended`).
- Custom lists, JSON export/import for watchlists, and sync across devices via Cloudflare D1.

### AI recommendations
- Recommendations from Google Gemini models (`gemini-3.1-flash-lite`, `gemini-2.5-flash`) based on your watchlist and interactions.
- A "Picks For You" homepage row that refreshes twice daily and excludes titles already on your watchlist.
- Feedback loop: liking a recommendation adds it to your **Pebbly Picks** list; disliking one excludes it from future runs.
- Filter generation by watchlist, custom list, genre preferences, or era presets (Classics, 80s, 90s, 2000s, 2010s, 2020s).
- AI-suggested titles are verified against the TMDB API before display, and verified matches are cached.

---

## Tech stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) + React 19 |
| **Host & Compute** | [Cloudflare Workers](https://workers.cloudflare.com/) (Nitro `cloudflare_module` preset) |
| **Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) via [Drizzle ORM](https://orm.drizzle.team/) |
| **Validation** | [Valibot](https://valibot.dev/) (Lightweight, modular schema validation) |
| **Authentication** | [Clerk](https://clerk.com/) (`@clerk/react` + `@clerk/backend` JWT verification) |
| **AI Engine** | Google Gemini REST API (`generativelanguage.googleapis.com` via `fetch`, `gemini-3.1-flash-lite` + `gemini-2.5-flash` fallback chain) |
| **Styling** | Tailwind CSS 4, Radix UI, shadcn/ui |
| **Data Fetching** | TanStack Query (React Query) |
| **State Management** | Zustand |
| **Tooling & Linter** | Vite 7, Biome, TypeScript, Wrangler |

---

## Project structure

```text
├── drizzle/                         # Drizzle generated SQL migrations for Cloudflare D1
├── server/                          # Nitro server routes and scheduled tasks
│   ├── routes/api/health.ts         # /api/health endpoint (D1 status check)
│   └── tasks/snapshots.ts           # Daily watchlist snapshots cron task
├── src/
│   ├── server/                      # Co-located backend server functions & database layer
│   │   ├── db/                      # D1 database schema & Drizzle client
│   │   ├── fns/                     # Type-safe TanStack Start server functions (watchlist, lists, recs, admin)
│   │   ├── schema/                  # Valibot schemas & typed API result contracts
│   │   ├── auth.ts                  # Clerk server-side JWT verification & user resolution
│   │   ├── ai.ts                    # Gemini AI client with model fallback chain
│   │   ├── prompts.ts               # Context-aware prompts for AI recommendations
│   │   └── rbac.ts                  # Role-based access control & feature flags
│   ├── components/                  # UI components & domain-specific widgets
│   │   ├── homepage-recommendations.tsx # Homepage "Picks For You" row with interaction buttons
│   │   ├── video-player-modal.tsx   # Fullscreen-capable responsive video player
│   │   ├── media-card.tsx           # Reusable media grid/carousel card
│   │   └── recommendations/         # Recommendation loading skeletons and UI elements
│   ├── hooks/                       # Custom hooks (watchlist, watch progress, recommendations, RBAC)
│   ├── lib/                         # Core utility libraries, query keys, and TMDB queries
│   ├── routes/                      # TanStack file-based routes
│   └── types.d.ts                   # TypeScript declarations & domain types
├── wrangler.toml                    # Cloudflare Workers & D1 configuration
├── drizzle.config.ts                # Drizzle Kit migration generator config
└── drizzle.studio.config.ts         # Drizzle Studio dashboard config
```

---

## Getting started

### Prerequisites

- Node.js 22+
- `pnpm` (v10+)
- A TMDB API Read Access Token
- A Clerk Application
- A Google Gemini API Key
- A Cloudflare Account (with D1 database enabled)

### Environment setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Swastikdan/Pebbly.git
   cd Pebbly
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   Create a `.env` or `.env.local` file in the project root:
   ```env
   # TMDB API (read-only public API key, safe for client)
   VITE_PUBLIC_TMDB_ACCESS_TOKEN=your_tmdb_read_access_token
   VITE_PUBLIC_TMDB_API_URL=https://api.themoviedb.org/3

   # Clerk Auth
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_CLERK_PUBLISHABLE_KEY
   CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET_KEY
   CLERK_ISSUER_URL=https://your-app.clerk.accounts.dev

   # App URLs
   VITE_PUBLIC_APP_URL=http://localhost:3000
   VITE_PUBLIC_VIDEO_URL=your_video_provider_base_url

   # AI Providers
   GEMINI_API_KEY=your_gemini_key

   # Cloudflare (needed for `pnpm db:studio` dashboard & GitHub Actions)
   CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
   CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
   ```

4. **Initialize the local database:**
   ```bash
   pnpm db:migrate:local
   ```

---

## Running locally

- **Run frontend dev server (Vite + Node SSR):**
  ```bash
  pnpm dev
  ```

- **Run full Cloudflare Workers + Miniflare D1 emulator locally:**
  ```bash
  pnpm preview:cf
  ```

- **Run TypeScript validation & Biome linting:**
  ```bash
  pnpm typecheck
  pnpm lint
  ```

---

## Database and migrations

- **Generate new SQL migration after editing `src/server/db/schema.ts`:**
  ```bash
  pnpm db:generate
  ```

- **Apply migrations to local database (`.wrangler` emulator):**
  ```bash
  pnpm db:migrate:local
  ```

- **Apply migrations to remote Cloudflare D1 database (Production):**
  ```bash
  pnpm db:migrate:prod
  ```

- **Open Drizzle Studio to view/edit database tables in your browser:**
  ```bash
  pnpm db:studio
  ```

---

## Deploying to Cloudflare

Deploying to Cloudflare Workers is automated via GitHub Actions CI/CD whenever you push to the deployment branch, or you can deploy manually:

```bash
# 1. Apply any pending migrations to production D1
pnpm db:migrate:prod

# 2. Build and publish to Cloudflare Workers
pnpm deploy:cf
```

---

## Available scripts

| Script | Description |
| :--- | :--- |
| `pnpm dev` | Run Vite development server |
| `pnpm preview:cf` | Build and run full app on local Cloudflare Worker & D1 emulator |
| `pnpm build` | Build production bundle (Nitro Cloudflare preset) |
| `pnpm db:generate` | Generate SQL migrations from `src/server/db/schema.ts` |
| `pnpm db:migrate:local` | Apply migrations to local Miniflare D1 database |
| `pnpm db:migrate:prod` | Apply migrations to Cloudflare production D1 database |
| `pnpm db:studio` | Launch Drizzle Studio database explorer |
| `pnpm deploy:cf` | Build and deploy directly to Cloudflare Workers |
| `pnpm typecheck` | Run TypeScript compiler type-checking |
| `pnpm lint` | Run Biome linter |
| `pnpm format` | Auto-format codebase with Biome |

---

## License and acknowledgments

- Released under the [MIT License](./LICENSE).
- Movie and TV metadata provided by [TMDB](https://www.themoviedb.org/).
- AI Recommendations powered by [Google Gemini](https://ai.google.dev/).
- Built with TanStack Start, Cloudflare Workers, D1, Drizzle ORM, Valibot, Clerk, and Tailwind CSS.

Contributions are welcome, see [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md).
