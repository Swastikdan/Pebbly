# Pebbly (Film Fanatic)

Pebbly is a modern, full-stack movie and TV show discovery application built with TanStack Start, Convex, Clerk, Google Gemini AI, and TMDB metadata. It combines rich media browsing with persistent watchlists, granular episode progress tracking, custom user lists, and a personalized AI Recommendation Engine.

---

## Key Features

### Media Discovery & Watchlist
- **Comprehensive Browsing**: Explore trending, popular, top-rated, upcoming, and curated movie/TV collections.
- **Advanced Search**: Instant cross-media search with genre, media type, and keyword filtering.
- **Rich Details & Media Player**: Complete detail pages with cast/crew, trailers, season/episode browsers, and embedded video modal with responsive controls.
- **Smart Watchlist & Progress**: Track progress (`want-to-watch`, `watching`, `caught-up`, `finished`, `dropped`), per-episode watching status, and reaction tags (`loved`, `liked`, `mixed`, `not-for-me`).
- **Custom Lists & Management**: Create custom lists, export/import watchlists in JSON format, and sync seamlessly across devices via Convex.

### AI Recommendation Engine
- **Watchlist & Interaction-Aware AI**: Generates tailored movie and TV recommendations using Google Gemini models (`gemini-3.1-flash-lite-preview`, `gemini-2.5-flash`, etc.).
- **Homepage "Picks For You"**: Dedicated homepage widget providing twice-daily refreshed recommendations with real-time watchlist exclusion.
- **Interaction Feedback Loop**: User interactions (thumbs up / thumbs down) train future recommendations. Liked recommendations are automatically added to your **Pebbly Picks** list, and disliked titles are excluded.
- **Advanced Filtering**: Generate recommendations by Watchlist, Custom List, Genre preferences, or Era presets (Classics, 80s, 90s, 2000s, 2010s, 2020s).
- **History & Resolution Verification**: Automatically verifies AI-suggested titles against TMDB API data and caches verified matches.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) + React 19 |
| **Backend & Realtime** | [Convex](https://www.convex.dev/) |
| **AI Engine** | Google GenAI SDK (`@google/genai` - Gemini Flash models) |
| **Authentication** | [Clerk](https://clerk.com/) |
| **Styling** | Tailwind CSS 4, Radix UI, shadcn/ui |
| **Data Fetching** | TanStack Query (React Query) |
| **State Management** | Zustand |
| **Tooling & Linter** | Vite 7, Biome, TypeScript |

---

## Project Structure

```
├── convex/                          # Convex backend schemas, queries, mutations, and actions
│   ├── schema.ts                    # Database tables (users, watch_items, ai_recommendations, lists, etc.)
│   ├── recommendations.ts           # AI recommendation engine actions, prompts, and feedback handling
│   ├── watchlist.ts                 # Watchlist management, custom lists, and snapshots
│   ├── crons.ts                     # Scheduled background tasks (e.g. daily watchlist snapshots)
│   └── admin.ts                     # Feature flags & RBAC permission checks
├── src/
│   ├── components/                  # UI components & domain-specific widgets
│   │   ├── homepage-recommendations.tsx # Homepage "Picks For You" row with interaction buttons
│   │   ├── video-player-modal.tsx   # Fullscreen-capable responsive video player
│   │   ├── media-card.tsx           # Reusable media grid/carousel card
│   │   └── recommendations/        # Recommendation loading skeletons and UI elements
│   ├── hooks/                       # Custom hooks (watchlist, watch progress, recommendations, RBAC)
│   │   ├── use-recommendations.ts   # Client-side hook for AI recommendation generation & history
│   │   └── use-permissions.ts       # RBAC & feature flag access control hook
│   ├── lib/                         # Core utility libraries & clients
│   │   ├── recommendation-engine.ts # Shared TMDB resolution engine, fuzzy matching & caching hooks
│   │   ├── queries.ts               # TMDB API query functions
│   │   └── media-transform.ts       # TMDB payload transformations
│   ├── routes/                      # TanStack file-based routes
│   │   ├── index.tsx                # Homepage route
│   │   ├── recommendations.lazy.tsx # AI Recommendations management & generation page
│   │   └── search.lazy.tsx          # Search & discovery page
│   └── types.d.ts                   # TypeScript declarations & domain types
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- `pnpm` (or `npm`/`yarn`)
- A TMDB API Read Access Token
- A Clerk Application
- A Convex Deployment
- A Google Gemini API Key

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Swastikdan/Pebbly.git
   cd Pebbly
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

4. Set the Gemini API key in your Convex deployment environment variables:
   ```bash
   npx convex env set GEMINI_API_KEY your_gemini_api_key
   ```

### Running Locally

- Run frontend & Convex dev server concurrently:
  ```bash
  pnpm dev
  ```

- Run typecheck and Biome validation:
  ```bash
  pnpm check
  ```

- Build for production:
  ```bash
  pnpm build
  ```

---

## Available Scripts

- `pnpm dev` — Run Vite frontend and Convex dev server in parallel
- `pnpm dev:vite` — Run frontend dev server only
- `pnpm dev:convex` — Run Convex local dev server only
- `pnpm build` — Type-check and build production bundle
- `pnpm check` — Biome linter check + TypeScript validation
- `pnpm format` — Format code with Biome

---

## License & Acknowledgments

- Movie and TV metadata provided by [TMDB](https://www.themoviedb.org/).
- AI Recommendations powered by [Google Gemini](https://ai.google.dev/).
- Built with TanStack, Convex, Clerk, and Tailwind CSS.
