# Film Fanatic

Film Fanatic is a full-stack movie and TV discovery app built with TanStack Start, Convex, Clerk, and TMDB data. It combines rich media browsing with a persistent watchlist, progress tracking, and a responsive UI for both guests and signed-in users.

## Features

- Browse trending, popular, top-rated, upcoming, and curated movie/TV lists
- Search across movies, TV shows, and people with filtering and pagination
- View rich detail pages with cast, crew, trailers, images, seasons, and recommendations
- Save titles to a watchlist with guest-local storage or authenticated Convex sync
- Track progress with statuses like `want-to-watch`, `watching`, `caught-up`, `finished`, and `dropped`
- Mark TV episodes as watched and keep per-show progress up to date
- Add reaction tags such as `loved`, `liked`, `mixed`, and `not-for-me`
- Import and export your watchlist as JSON
- Toggle between light and dark themes

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Framework | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) + React 19 |
| Backend / Data | [Convex](https://www.convex.dev/) |
| Authentication | [Clerk](https://clerk.com/) |
| Styling | Tailwind CSS 4, Radix UI, shadcn/ui |
| Data Fetching | TanStack Query |
| Client State | Zustand |
| Validation | Valibot |
| Tooling | Vite 7, Biome, TypeScript |

## Getting Started

### Prerequisites

- Node.js 20+
- `pnpm`
- A TMDB API read access token
- A Clerk application
- A Convex project

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Swastikdan/Film-Fanatic.git
   cd Film-Fanatic
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env.local` file in the project root:

   ```env
   VITE_PUBLIC_TMDB_ACCESS_TOKEN=your_tmdb_read_access_token
   VITE_PUBLIC_TMDB_API_URL=https://api.themoviedb.org/3

   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   CONVEX_CLERK_ISSUER_URL=https://your-clerk-domain

   VITE_CONVEX_URL=your_convex_url
   VITE_PUBLIC_APP_URL=http://localhost:3000
   VITE_PUBLIC_VIDEO_URL=your_video_provider_base_url
   ```

   Depending on your Convex setup, the Convex CLI may also add deployment-specific variables such as `CONVEX_DEPLOYMENT` to `.env.local`.

4. Start the app:

   ```bash
   pnpm dev
   ```

   This runs the Vite app on port `3000` and `convex dev` in parallel.

5. Build for production:

   ```bash
   pnpm build
   ```

## Available Scripts

- `pnpm dev` — run Vite and Convex in parallel
- `pnpm dev:vite` — run only the frontend dev server
- `pnpm dev:convex` — run only Convex locally
- `pnpm build` — type-check and build the app
- `pnpm serve` — build and run the production server locally
- `pnpm check` — Biome check + TypeScript validation
- `pnpm lint` — lint with Biome
- `pnpm format` — format the codebase with Biome

## Project Structure

- `src/routes` — file-based application routes
- `src/components` — shared UI and domain-specific media components
- `src/hooks` — watchlist, progress, and client-side state hooks
- `src/lib` — TMDB client, query helpers, transforms, and utilities
- `convex` — schema, auth config, and backend queries/mutations
- `public` — static assets and web app metadata

## Notes

- `src/routeTree.gen.ts` is generated; do not edit it manually.
- Guest watchlist data is stored locally and synced to Convex after sign-in.
- There is currently no dedicated automated test suite configured; use `pnpm check` for linting and type-checking.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run `pnpm check`.
5. Open a pull request.

## Acknowledgments

- Movie and TV metadata is provided by [TMDB](https://www.themoviedb.org/).
- Built with TanStack, Convex, Clerk, Vite, and Tailwind CSS.
