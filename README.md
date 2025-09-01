## Security Notice

`NEXT_PUBLIC_TMDB_ACCESS_TOKEN` is exposed to the client. Any environment variable prefixed with `NEXT_PUBLIC_` in Next.js will be available in the browser. If you do not want to expose your TMDB access token to users, remove the `NEXT_PUBLIC_` prefix and use server-side rendering (SSR) or API routes to keep your token secure. Refer to the Next.js documentation for best practices.

# Film Fanatic

A modern, responsive web application for discovering and exploring movies and TV shows. Built with Next.js 15, TypeScript, and powered by The Movie Database (TMDB) API.

![Film Fanatic](https://img.shields.io/badge/Film-Fanatic-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-38B2AC?style=for-the-badge&logo=tailwind-css)

## Features

### Core Functionality

- Movie & TV Show Discovery: Browse popular, top-rated, now playing, and upcoming content
- Advanced Search: Search across movies, TV shows, and people with real-time results
- Detailed Information: Comprehensive details including cast, crew, trailers, images, and reviews
- Personal Watchlist: Save and manage your favorite movies and TV shows locally
- Collections: Explore movie collections and franchises
- Responsive Design: Optimized for desktop, tablet, and mobile devices

### User Experience

- Dark/Light Theme: Toggle between themes with system preference detection
- Smooth Animations: Powered by Framer Motion for fluid interactions
- Fast Loading: Optimized with React Query for efficient data fetching and caching
- SEO Optimized: Dynamic meta tags and Open Graph support
- Progressive Web App: Installable with offline capabilities

### Navigation & Organization

- Intuitive Navigation: Easy-to-use navbar with dropdown menus
- Smart Routing: SEO-friendly URLs with proper slug handling
- Pagination: Efficient browsing through large datasets
- Share Functionality: Share movies and shows with others
- Export Watchlist: Export your watchlist data

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn
- TMDB API access token

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

3. **Environment Setup**
   Create a `.env.local` file in the root directory:

   ```env
   NEXT_PUBLIC_TMDB_ACCESS_TOKEN=your_tmdb_access_token_here
   NEXT_PUBLIC_TMDB_API_URL=https://api.themoviedb.org/3
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Start the development server**

   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Getting TMDB API Access

1. Create an account at [The Movie Database](https://www.themoviedb.org/)
2. Go to your account settings → API
3. Request an API key
4. Use the "API Read Access Token" in your environment variables

## 🛠️ Tech Stack

### Frontend Framework

- **Next.js 15** - React framework with App Router
- **React 18** - UI library with latest features
- **TypeScript 5.6** - Type-safe development

### Styling & UI

- **TailwindCSS 4.1** - Utility-first CSS framework
- **HeroUI** - Modern React component library
- **Framer Motion** - Animation library
- **next-themes** - Theme management

### State Management & Data Fetching

- **TanStack Query (React Query)** - Server state management
- **Zustand** - Client state management for watchlist
- **Zod** - Runtime type validation

### Development Tools

- **ESLint** - Code linting with Next.js config
- **Prettier** - Code formatting
- **TypeScript** - Static type checking
- **pnpm** - Fast, disk space efficient package manager

## 📁 Project Structure

```
film-fanatic/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── collection/        # Movie collections
│   ├── list/             # Movie/TV lists
│   ├── movie/            # Movie detail pages
│   ├── search/           # Search functionality
│   ├── tv/               # TV show detail pages
│   └── watchlist/        # User watchlist
├── components/            # Reusable React components
│   ├── media/            # Media-specific components
│   └── primitives.ts     # Base component definitions
├── config/               # Configuration files
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and API clients
├── public/               # Static assets
├── styles/               # Global styles
└── types.d.ts           # TypeScript type definitions
```

## 🎯 Available Scripts

```bash
# Development
pnpm dev          # Start development server with Turbo
pnpm build        # Build for production
pnpm start        # Start production server
pnpm preview      # Build and start production server

# Code Quality
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm typecheck    # Run TypeScript compiler check
pnpm check        # Run both lint and typecheck

# Formatting
pnpm format:check # Check code formatting
pnpm format:write # Format code with Prettier
```

## 🌟 Key Features Deep Dive

### Movie & TV Show Pages

- Comprehensive information display
- Cast and crew details with photos
- Trailers and video content
- Image galleries (posters, backdrops)
- User ratings and reviews
- Recommendations based on current selection
- Collection information for movie franchises

### Search Functionality

- Multi-search across movies, TV shows, and people
- Real-time search results
- Filter by content type
- Pagination for large result sets
- Search history and suggestions

### Watchlist Management

- Add/remove movies and TV shows
- Persistent storage using localStorage
- Export functionality for backup
- Quick access from any page
- Visual indicators for watchlisted items

### Responsive Design

- Mobile-first approach
- Adaptive layouts for all screen sizes
- Touch-friendly interactions
- Optimized images with lazy loading
- Fast loading on all devices

## 🔧 Configuration

### Environment Variables

| Variable                        | Description           | Required |
| ------------------------------- | --------------------- | -------- |
| `NEXT_PUBLIC_TMDB_ACCESS_TOKEN` | TMDB API access token | Yes      |
| `NEXT_PUBLIC_TMDB_API_URL`      | TMDB API base URL     | Yes      |
| `NEXT_PUBLIC_APP_URL`           | Your app's URL        | Yes      |

### Customization

- **Themes**: Modify theme configuration in `tailwind.config.cjs`
- **Site Config**: Update site information in `config/site.ts`
- **Navigation**: Customize navigation items in the site config
- **Styling**: Global styles in `styles/globals.css`

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on every push

### Other Platforms

The app can be deployed on any platform that supports Next.js:

- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify
- Self-hosted with Docker ( Docker file is not provided in the root directory )

## Contributing

We welcome contributions to Film Fanatic.

How to contribute:

1. Fork the repository and create your branch from `main`.
2. Follow the existing code style and use TypeScript for type safety.
3. Add proper error handling and test your changes thoroughly.
4. Update documentation as needed.
5. Submit a Pull Request with a clear description of your changes.

For major changes, please open an issue first to discuss your proposal before submitting a pull request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- [The Movie Database (TMDB)](https://www.themoviedb.org/) for providing the comprehensive movie and TV show data
- [HeroUI](https://heroui.com/) for the beautiful component library
- [Next.js](https://nextjs.org/) team for the amazing framework
- All contributors and users of this project
