# Film Fanatic

A premium, full-stack media discovery and tracking platform built for the modern cinephile. Experience seamless movie and TV show exploration with real-time tracking, powered by a state-of-the-art tech stack.

---

## Features

### Precision Discovery

* **Intelligent Search:** Real-time, multi-category search across movies, TV series, and people with advanced filtering (rating, type).
* **Rich Media Context:** Immersive detail pages featuring trailers, cast/crew insights, high-definition galleries, and collections.
* **Smart Recommendations:** Discover your next favorite film with context-aware suggestions based on what you're viewing.

### Seamless Tracking and Watchlist

* **Hybrid Storage:** Local-first performance with `localStorage` for guests, seamlessly synchronized to the cloud via **Convex** for authenticated users.
* **Granular Episode Tracking:** Mark individual episodes as watched. Progress automatically calculates show completion.
* **Advanced Statuses:** Manage your journey with statuses: *Plan to Watch*, *Watching*, *Completed*, or *Dropped*.
* **Emotional Reactions:** Log your feelings with reactions like *Loved*, *Liked*, *Mixed*, or *Not for me*.

### Premium User Experience

* **Aesthetic Design:** A stunning, responsive UI built with Tailwind CSS 4.0, featuring glassmorphism, smooth transitions, and high-fidelity posters.
* **Optimistic UI:** Actions feel instantaneous thanks to optimistic updates and TanStack Query caching.
* **Universal Access:** Fully responsive layout optimized for everything from ultra-wide monitors to mobile devices.
* **Identity Management:** Secure and simple authentication powered by **Clerk**.

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [TanStack Start](https://tanstack.com/router/v1/docs/guide/start-overview) (Nitro + React 19) |
| **Backend** | [Convex](https://www.convex.dev/) (Real-time Database & Functions) |
| **Authentication** | [Clerk](https://clerk.com/) |
| **Styling** | [Tailwind CSS 4.0](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [shadcn/ui](https://ui.shadcn.com/) |
| **Data Fetching** | [TanStack Query](https://tanstack.com/query/latest) (React Query) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) (Client-side) |
| **Optimization** | [React Compiler](https://react.dev/learn/react-compiler), [@unpic/react](https://unpic.pics/img/react/) |
| **Code Quality** | [Biome](https://biomejs.dev/) (Lister, Formatter) |

---

## Getting Started

### Prerequisites

* **Node.js** 20+
* **pnpm** (preferred)
* **TMDB API Key** ([Get one here](https://www.themoviedb.org/settings/api))
* **Convex Account**
* **Clerk Account**

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/Swastikdan/Film-Fanatic.git
   cd film-fanatic
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**

   Create a `.env.local` file in the root:

   ```env
   # TMDB
   VITE_TMDB_ACCESS_TOKEN=your_token_here
   VITE_TMDB_API_URL=https://api.themoviedb.org/3
   
   # Clerk (Authentication)
   VITE_CLERK_PUBLISHABLE_KEY=your_key_here
   CLERK_SECRET_KEY=your_secret_here
   
   # Convex (Backend)
   CONVEX_DEPLOY_KEY=your_key_here # For deployment
   VITE_CONVEX_URL=your_convex_url_here
   ```

4. **Start Development**

   ```bash
   # Runs both Vite and Convex Dev in parallel
   pnpm dev
   ```

5. **Build for Production**

   ```bash
   pnpm build
   ```

---

## Project Structure

* **/convex**: Backend schema, mutations, and queries (Convex functions).
* **/src/components**: Modular UI components (shadcn/ui, media cards, layout).
* **/src/hooks**: Custom React hooks for data fetching and state sync.
* **/src/lib**: Utility functions and client instances (Convex, Clerk, API).
* **/src/routes**: File-based routing system (TanStack Router).
* **/public**: Static assets and icons.

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Run `pnpm check` to ensure code quality/types.
5. Push to the branch (`git push origin feature/AmazingFeature`).
6. Open a Pull Request.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Acknowledgments

* [The Movie Database (TMDB)](https://www.themoviedb.org/) for the incredible data.
* [TanStack Team](https://tanstack.com/) for the world-class routing and data tools.
* [Vercel](https://vercel.com/) for hosting and deployment support.
