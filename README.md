# Film Fanatic

**Film Fanatic** is a web application for exploring and discovering movies and TV shows. Built with the **T3 Stack**, this project provides a robust foundation for a modern, high-performance web experience.

## ✨ Features

- **Discover Content:** Browse popular, top-rated, and upcoming movies and TV shows.
- **Detailed Information:** View comprehensive details about individual movies and TV shows, including cast, crew, trailers, and more.
- **Search Functionality:** Find specific titles with a powerful, fast search.
- **Responsive Design:** A seamless viewing experience on any device, thanks to a mobile-first approach.
- **Powered by TMDb:** All movie and TV data is fetched from The Movie Database (TMDb) API.

---

## 🛠️ Technologies Used

This project is built on the **T3 Stack**, a modern web development stack designed for building scalable, type-safe applications.

- **Next.js:** A React framework for building full-stack applications.
- **NextAuth.js:** For authentication (currently a placeholder, but ready to be integrated).
- **Prisma** or **Drizzle:** You can choose between these two powerful ORMs for database interaction.
- **tRPC:** A type-safe API layer that allows you to build APIs with great developer experience.
- **Tailwind CSS:** A utility-first CSS framework for rapid and responsive UI development.
- **shadcn/ui:** A collection of beautifully designed, reusable UI components built with Radix UI and Tailwind CSS.
- **TanStack Query:** For managing and caching server-state data.
- **Zustand:** A small, fast, and scalable state-management solution.

---

## 🚀 Getting Started

### Prerequisites

To run this project, you'll need the following installed:

- Node.js (v18 or newer)
- pnpm (or another package manager like npm or yarn)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Swastikdan/Film-Fanatic
   cd film-fanatic
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   Copy the `.env.example` file to a new file named `.env`:

   ```bash
   cp .env.example .env
   ```

   Then, fill in the required values from your TMDb account:
   - `NEXT_PUBLIC_TMDB_ACCESS_TOKEN`: Your bearer token for the TMDb API.
   - `NEXT_PUBLIC_TMDB_API_URL`: The base URL for the TMDb API.

4. **Start the development server:**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) in your browser to see the application.

---

## 📦 Scripts

This project includes several useful scripts to help with development:

| Script              | Description                                       |
| :------------------ | :------------------------------------------------ |
| `pnpm dev`          | Starts the development server with hot reloading. |
| `pnpm build`        | Compiles the application for production.          |
| `pnpm start`        | Starts a production-ready server after building.  |
| `pnpm lint`         | Runs ESLint to check for code style issues.       |
| `pnpm lint:fix`     | Automatically fixes linting errors.               |
| `pnpm format:check` | Checks for formatting issues with Prettier.       |
| `pnpm format:write` | Automatically formats code with Prettier.         |
| `pnpm typecheck`    | Runs TypeScript to check for type errors.         |

---

## 🗺️ Project Structure

- `src/`: The main source directory for the application.
  - `app/`: Next.js App Router for pages and API routes.
  - `components/`: Reusable React components, including a dedicated `ui` folder for `shadcn/ui`.
  - `constants.ts`: Contains constant values like navigation items, API image prefixes, and genre lists.
  - `env.js`: Handles environment variable validation using `@t3-oss/env-nextjs`.
  - `styles/`: Global CSS styles.
  - `types.d.ts`: Contains shared TypeScript interfaces for API responses and data structures.

  ### File Structure

```
  Directory structure:

  ├── README.md
  ├── components.json
  ├── eslint.config.js
  ├── next.config.ts
  ├── package.json
  ├── postcss.config.js
  ├── prettier.config.js
  ├── tsconfig.json
  ├── .env.example
  ├── .npmrc
  └── src/
  ├── constants.ts
  ├── env.js
  ├── types.d.ts
  ├── app/
  │ ├── layout.tsx
  │ ├── manifest.ts
  │ ├── not-found.tsx
  │ ├── ogimage.webp
  │ ├── page.tsx
  │ ├── robots.ts
  │ ├── sitemap.ts
  │ ├── api/
  │ │ └── metaimage/
  │ │ └── route.ts
  │ ├── collection/
  │ │ └── [id]/
  │ │ └── page.tsx
  │ ├── disclaimer/
  │ │ └── page.tsx
  │ ├── list/
  │ │ └── [type]/
  │ │ └── [slug]/
  │ │ └── page.tsx
  │ ├── movie/
  │ │ └── [id]/
  │ │ └── [slug]/
  │ │ ├── page.tsx
  │ │ ├── cast-crew/
  │ │ │ └── page.tsx
  │ │ ├── media/
  │ │ │ └── page.tsx
  │ │ └── recommendations/
  │ │ └── page.tsx
  │ ├── search/
  │ │ └── page.tsx
  │ ├── tv/
  │ │ └── [id]/
  │ │ └── [slug]/
  │ │ ├── page.tsx
  │ │ ├── cast-crew/
  │ │ │ └── page.tsx
  │ │ ├── media/
  │ │ │ └── page.tsx
  │ │ ├── recommendations/
  │ │ │ └── page.tsx
  │ │ └── seasons/
  │ │ └── page.tsx
  │ └── watchlist/
  │ └── page.tsx
  ├── components/
  │ ├── desktop-nav-button.tsx
  │ ├── export-and-add-watchlist.tsx
  │ ├── footer.tsx
  │ ├── go-back.tsx
  │ ├── homepage-media-list-section.tsx
  │ ├── media-card.tsx
  │ ├── media-credit-section.tsx
  │ ├── media-list-page-results.tsx
  │ ├── movie-page-data.tsx
  │ ├── navbar.tsx
  │ ├── pagination.tsx
  │ ├── providers.tsx
  │ ├── scroll-container.tsx
  │ ├── scroll.tsx
  │ ├── search-bar.tsx
  │ ├── search-results.tsx
  │ ├── share-button.tsx
  │ ├── theme-provider.tsx
  │ ├── theme-toggle.tsx
  │ ├── tv-page-data.tsx
  │ ├── watch-list-button.tsx
  │ ├── watchlist-contatiner.tsx
  │ ├── media/
  │ │ ├── cast-section.tsx
  │ │ ├── collections.tsx
  │ │ ├── current-season.tsx
  │ │ ├── genre-container.tsx
  │ │ ├── media-collection.tsx
  │ │ ├── media-container.tsx
  │ │ ├── media-description.tsx
  │ │ ├── media-images.tsx
  │ │ ├── media-keywords.tsx
  │ │ ├── media-poster-trailer-container.tsx
  │ │ ├── media-recommendation.tsx
  │ │ ├── media-recommendationpage-container.tsx
  │ │ ├── media-title-container.tsx
  │ │ ├── media-videos.tsx
  │ │ ├── rating-count.tsx
  │ │ ├── recomendations.tsx
  │ │ └── season-container.tsx
  │ └── ui/
  │ ├── accordion.tsx
  │ ├── badge.tsx
  │ ├── button.tsx
  │ ├── card.tsx
  │ ├── dialog.tsx
  │ ├── dropdown-menu.tsx
  │ ├── image.tsx
  │ ├── input.tsx
  │ ├── label.tsx
  │ ├── sheet.tsx
  │ ├── skeleton.tsx
  │ ├── spinner.tsx
  │ ├── tabs.tsx
  │ └── tooltip.tsx
  ├── hooks/
  │ └── usewatchlist.ts
  ├── lib/
  │ ├── queries.ts
  │ ├── query-client.ts
  │ ├── tmdb.ts
  │ └── utils.ts
  ├── store/
  │ └── usewatchliststore.ts
  └── styles/
  └── globals.css
```

---

## ⚙️ Configuration

- **Next.js (`next.config.ts`):** Includes performance optimizations like image compression, experimental features (like CSS chunking and React Compiler), and security headers.
- **ESLint (`eslint.config.js`):** A custom configuration for Next.js and TypeScript, with specific rules to maintain code quality.
- **Tailwind CSS (`tailwind.config.js`, `postcss.config.js`):** Configured for use with `@tailwindcss/postcss`.
- **Prettier (`prettier.config.js`):** Ensures consistent code formatting across the project.
- **TypeScript (`tsconfig.json`):** Configured for strict type checking and path aliases (`@/`).

## 🤝 Contributing

We welcome contributions\! If you have suggestions or find a bug, please feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License.
