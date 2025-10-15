# Film Fanatic

A modern, responsive web application for discovering and exploring movies and TV shows. Built with **TanStack Start**, **React Compiler**, **TypeScript**, **Biome** (linting/formatting), **Nitro** with `nitroV2Plugin` for server deployment, and **shadcn/ui** for UI components. Powered by The Movie Database (TMDB) API.



## Security notice

`VITE_TMDB_ACCESS_TOKEN` is exposed to the client. Any environment variable prefixed with `VITE_` will be available in the browser via `import.meta.env`. If you do not want to expose your TMDB access token, remove the `VITE_` prefix and use server functions to keep the token on the server side.



## Features

### Core functionality

* **Discovery:** Browse popular, top-rated, now-playing, and upcoming movies and TV shows
* **Advanced search:** Real-time search across movies, TV shows, and people
* **Detailed pages:** Cast, crew, trailers, images, reviews, and recommendations
* **Personal watchlist:** Save and manage favorites locally with export support
* **Collections:** Explore franchises and collection pages
* **Responsive:** Optimized for desktop, tablet, and mobile

### User experience

* **Dark / Light theme** with system preference detection
* **Smooth animations** powered by Framer Motion
* **Fast loading** via TanStack Query caching and optimized requests
* **SEO friendly**: dynamic meta tags and Open Graph support
* **Progressive Web App**: installable, offline-capable

### Navigation & organization

* Intuitive navbar with dropdowns
* SEO-friendly routing and slugs via TanStack Router
* Pagination for large result sets
* Share and export watchlist functionality


## Quick start

### Prerequisites

* Node.js 20+
* pnpm (recommended) or npm / yarn
* TMDB API access token

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/Swastikdan/Film-Fanatic.git
cd Film-Fanatic
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Environment setup**

Create `.env` in the project root:

```text
VITE_TMDB_ACCESS_TOKEN=your_tmdb_access_token_here
VITE_TMDB_API_URL=https://api.themoviedb.org/3
VITE_APP_URL=http://localhost:3000
```

For local-only overrides, create `.env.local` (add to `.gitignore`):

```text
VITE_TMDB_ACCESS_TOKEN=your_local_token_here
```

4. **Start development server**

```bash
pnpm dev
```

5. Open browser: `http://localhost:3000`

### Getting a TMDB API token

1. Create an account at The Movie Database (TMDB)
2. Account → Settings → API
3. Request an API key and use the **API Read Access Token** in your environment variables



## Tech stack

### Frontend

* **TanStack Start** — full-stack React framework with streaming SSR
* **TanStack Router** — type-safe routing
* **React 19**
* **React Compiler 1.0** — automatic memoization/optimizations
* **TypeScript 5.6**

### Styling & UI

* **Tailwind CSS 4.1**
* **shadcn/ui** (Radix-based components)

### State & data

* **TanStack Query (React Query)** — server state and caching
* **Zustand** — client state for watchlist
* **Zod** — runtime validation

### Dev tools & build

* **Vite** — dev server and build tool
* **Biome** — linting, formatting, import sorting
* **Nitro** with `nitroV2Plugin` — universal server deployment
* **pnpm** — package manager
* **T3 Env** — type-safe env validation



## Available scripts

```bash
# Development
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm preview      # Preview production build

# Code quality (Biome)
pnpm lint         # Run Biome linter
pnpm lint:fix     # Fix Biome issues
pnpm format       # Format code with Biome
pnpm typecheck    # Run TypeScript compiler check
pnpm check        # Run both lint and typecheck
```



## Deep dives

### Movie & TV show pages

* Server-side rendered details
* Cast and crew profiles with photos
* Embedded trailers and image galleries
* Ratings, reviews, and recommendations
* Collection/franchise pages

### Search

* Multi-search across movies, TV shows, and people
* Real-time results with TanStack Query
* Filters by content type and pagination
* Search history and suggestions

### Watchlist

* Add/remove items with persistent `localStorage` storage
* Export/backup watchlist data
* Quick access across the app

### Responsive design

* Mobile-first layouts and touch-friendly interactions
* Lazy-loaded images for performance
* Adaptive UI for all screen sizes



## Configuration

### Environment variables

TanStack Start uses Vite environment variables with T3 Env for validation.

|                 Variable | Description           | Context | Required |
| -----------------------: | --------------------- | ------: | :------: |
| `VITE_TMDB_ACCESS_TOKEN` | TMDB API access token |  Client |    Yes   |
| `VITE_TMDB_API_URL`      | TMDB API base URL     |  Client |    Yes   |
| `VITE_APP_URL`           | App URL               |  Client |    Yes   |

**Environment file load order**

1. `.env.local` — local overrides (ignore in VCS)
2. `.env` — default variables (committed)

### Customization

* **Themes:** `tailwind.config.cjs`
* **Site config:** `config/site.ts`
* **Navigation:** update site config navigation items
* **Global styles:** `styles/globals.css`
* **Routing:** `app/router.tsx` or file-based routes
* **shadcn/ui components:** `components/` directory


## Contributing

1. Fork the repository and create a branch from `main`
2. Follow code style and use TypeScript
3. Use Biome for lint/format (`pnpm lint:fix`, `pnpm format`)
4. Add error handling and tests where appropriate
5. Update documentation for breaking changes
6. Open a pull request with a clear description

For major changes, open an issue first to discuss the proposal.


## License

This project is open source under the **MIT License**.


## Acknowledgments

* The Movie Database (TMDB) — data provider
* TanStack — Start, Router, Query libraries
* shadcn/ui — component library
* Biome — linting and formatting
* Vite — build tool
* Nitro — server deployment
* React Team — React Compiler and React ecosystem
