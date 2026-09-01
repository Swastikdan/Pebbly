// Build-time environment marker, injected by the deploy workflows:
// preview.yml sets "preview", production/CI set "production". Absent locally.
// Branding note: the app NAME and page titles always stay "Pebbly"; only the
// navbar pill and canonical URL reflect the environment.
export const IS_PREVIEW_BUILD =
  import.meta.env.VITE_PUBLIC_APP_ENV === "preview";

// True only under the Vite dev server (pnpm dev); statically false in every
// production bundle.
export const IS_DEV_BUILD = !IS_PREVIEW_BUILD && import.meta.env.DEV === true;

export const SITE_CONFIG = {
  name: "Pebbly",
  description:
    "Track what you watch and keep custom lists, with AI recommendations built from your viewing history.",
  url: IS_PREVIEW_BUILD
    ? "https://pebbly-preview.swastik.workers.dev"
    : "https://pebbly.swastik.workers.dev",
  defaultMetaImage:
    "https://ik.imagekit.io/swastikdan/Film-Fanatic/public/ogimage.webp",
  navItems: [
    {
      name: "Movies",
      slug: "movies",
      submenu: [
        { name: "Popular", url: "/list/movies/popular", slug: "popular" },
        {
          name: "Now Playing",
          url: "/list/movies/now-playing",
          slug: "now-playing",
        },
        { name: "Top Rated", url: "/list/movies/top-rated", slug: "top-rated" },
        { name: "Upcoming", url: "/list/movies/upcoming", slug: "upcoming" },
      ],
    },
    {
      name: "TV Shows",
      slug: "tv-shows",
      submenu: [
        { name: "Popular", url: "/list/tv-shows/popular", slug: "popular" },
        {
          name: "On The Air",
          url: "/list/tv-shows/on-the-air",
          slug: "on-the-air",
        },
        {
          name: "Top Rated",
          url: "/list/tv-shows/top-rated",
          slug: "top-rated",
        },
        {
          name: "Airing Today",
          url: "/list/tv-shows/airing-today",
          slug: "airing-today",
        },
      ],
    },
  ],

  Footerlinks: {
    github: "https://github.com/Swastikdan/Film-Fanatic",
    disclaimer: "/disclaimer",
  },
};

export const NAV_ITEMS = SITE_CONFIG.navItems;

export type MediaPageSlug = {
  type: "movies" | "tv-shows" | "peoples";
  slug:
    | "popular"
    | "now-playing"
    | "top-rated"
    | "upcoming"
    | "on-the-air"
    | "airing-today";
};

export const MEDIA_PAGE_SLUGS: MediaPageSlug[] = NAV_ITEMS.flatMap((item) =>
  item.submenu.map((subItem) => ({
    type: item.slug as "movies" | "tv-shows" | "peoples",
    slug: subItem.slug as MediaPageSlug["slug"],
  })),
);

export const GENRE_LIST = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 10770, name: "TV Movie" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
  { id: 10759, name: "Action & Adventure" },
  { id: 10762, name: "Kids" },
  { id: 10763, name: "News" },
  { id: 10764, name: "Reality" },
  { id: 10765, name: "Sci-Fi & Fantasy" },
  { id: 10766, name: "Soap" },
  { id: 10767, name: "Talk" },
  { id: 10768, name: "War & Politics" },
];

export const MAX_PAGINATION_LIMIT = 500;

export const RBAC_ROLES = ["admin", "video-player", "ai-integrations"] as const;
export type RbacRole = (typeof RBAC_ROLES)[number];
export const PERMISSION_ROLES = ["video-player", "ai-integrations"] as const;
export type PermissionRole = (typeof PERMISSION_ROLES)[number];

export const RBAC_FEATURES = {
  "video-player": {
    label: "Video Playback",
    description: "Built-in video player modal for streaming content",
  },
  "ai-recommendations": {
    label: "AI Recommendations",
    description:
      "AI-powered personalized movie and TV recommendations built from your viewing history.",
  },
} as const;
export type RbacFeature = keyof typeof RBAC_FEATURES;

export const DEFAULT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA1MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTM1LjYxNTQgMjBIMTQuMzg0NkMxNC4wMTc0IDIwIDEzLjY2NTIgMjAuMTUwOSAxMy40MDU2IDIwLjQxOTRDMTMuMTQ1OSAyMC42ODc5IDEzIDIxLjA1MjEgMTMgMjEuNDMxOFYzOS41NjgyQzEzIDM5Ljk0NzkgMTMuMTQ1OSA0MC4zMTIxIDEzLjQwNTYgNDAuNTgwNkMxMy42NjUyIDQwLjg0OTEgMTQuMDE3NCA0MSAxNC4zODQ2IDQxSDM1LjYxNTRDMzUuOTgyNiA0MSAzNi4zMzQ4IDQwLjg0OTEgMzYuNTk0NCA0MC41ODA2QzM2Ljg1NDEgNDAuMzEyMSAzNyAzOS45NDc5IDM3IDM5LjU2ODJWMjEuNDMxOEMzNyAyMS4wNTIxIDM2Ljg1NDEgMjAuNjg3OSAzNi41OTQ0IDIwLjQxOTRDMzYuMzM0OCAyMC4xNTA5IDM1Ljk4MjYgMjAgMzUuNjE1NCAyMFpNMzQuMjMwOCAzMi44ODY0TDI5LjgwNTMgMjcuODk0QzI5LjcyMTYgMjcuNzk4MyAyOS42MTk4IDI3LjcyMTIgMjkuNTA2MiAyNy42Njc2QzI5LjM5MjcgMjcuNjEzOSAyOS4yNjk4IDI3LjU4NDggMjkuMTQ1IDI3LjU4MkMyOS4wMjAyIDI3LjU3OTIgMjguODk2MSAyNy42MDI4IDI4Ljc4MDQgMjcuNjUxM0MyOC42NjQ3IDI3LjY5OTggMjguNTU5OCAyNy43NzIyIDI4LjQ3MjEgMjcuODY0MUwyMy41MzYxIDMyLjk2ODRMMjguNTMzNiAzOC4xMzY0SDI1LjkyMzFMMjEuNDk4OSAzMy41NjEyQzIxLjMyNTcgMzMuMzgyMyAyMS4wOTA5IDMzLjI4MTggMjAuODQ2MiAzMy4yODE4QzIwLjYwMTQgMzMuMjgxOCAyMC4zNjY2IDMzLjM4MjMgMjAuMTkzNSAzMy41NjEyTDE1Ljc2OTIgMzguMTM2NFYyMi44NjM2SDM0LjIzMDhWMzIuODg2NFpNMTcuNzA3NyAyNy4xNTkxQzE3LjcwNzcgMjYuNzA2IDE3LjgzNzYgMjYuMjYzMSAxOC4wODExIDI1Ljg4NjNDMTguMzI0NSAyNS41MDk2IDE4LjY3MDUgMjUuMjE2IDE5LjA3NTMgMjUuMDQyNkMxOS40ODAxIDI0Ljg2OTIgMTkuOTI1NSAyNC44MjM4IDIwLjM1NTMgMjQuOTEyMkMyMC43ODUgMjUuMDAwNiAyMS4xNzk4IDI1LjIxODggMjEuNDg5NiAyNS41MzkyQzIxLjc5OTQgMjUuODU5NiAyMi4wMTA0IDI2LjI2NzggMjIuMDk1OSAyNi43MTIyQzIyLjE4MTQgMjcuMTU2NSAyMi4xMzc1IDI3LjYxNzIgMjEuOTY5OCAyOC4wMzU4QzIxLjgwMjEgMjguNDU0NCAyMS41MTgyIDI4LjgxMjIgMjEuMTUzOSAyOS4wNjM5QzIwLjc4OTYgMjkuMzE1NiAyMC4zNjEyIDI5LjQ1IDE5LjkyMzEgMjkuNDVDMTkuMzM1NSAyOS40NSAxOC43NzIgMjkuMjA4NiAxOC4zNTY2IDI4Ljc3OUMxNy45NDExIDI4LjM0OTQgMTcuNzA3NyAyNy43NjY3IDE3LjcwNzcgMjcuMTU5MVoiIGZpbGw9IiNCNUI1QjUiLz4KPC9zdmc+Cg==";

export const IMAGE_PREFIX = {
  ORIGINAL: "https://image.tmdb.org/t/p/original",
  PREVIEW: "https://image.tmdb.org/t/p/w92",
  HD_POSTER: "https://image.tmdb.org/t/p/w780",
  HD_BACKDROP: "https://image.tmdb.org/t/p/w1280",
  HD_PROFILE: "https://image.tmdb.org/t/p/h632",
  SD_POSTER: "https://image.tmdb.org/t/p/w500",
  SD_BACKDROP: "https://image.tmdb.org/t/p/w780",
  SD_PROFILE: "https://image.tmdb.org/t/p/w185",
  LQ_POSTER: "https://image.tmdb.org/t/p/w342",
  LQ_BACKDROP: "https://image.tmdb.org/t/p/w300",
  LQ_PROFILE: "https://image.tmdb.org/t/p/w185",
} as const;
