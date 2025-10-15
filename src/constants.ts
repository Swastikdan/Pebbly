import { env } from "./env";

export const SITE_CONFIG = {
	name: "Film Fanatic",
	description:
		"Explore a vast collection of movies and TV shows with Film Fanatic.",
	url: env.VITE_PUBLIC_APP_URL,
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
].map((genre) => ({ ...genre, id: genre.id }));

export const MAX_PAGINATION_LIMIT = 500;

export const DEFAULT_PLACEHOLDER_IMAGE =
	"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA1MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTM1LjYxNTQgMjBIMTQuMzg0NkMxNC4wMTc0IDIwIDEzLjY2NTIgMjAuMTUwOSAxMy40MDU2IDIwLjQxOTRDMTMuMTQ1OSAyMC42ODc5IDEzIDIxLjA1MjEgMTMgMjEuNDMxOFYzOS41NjgyQzEzIDM5Ljk0NzkgMTMuMTQ1OSA0MC4zMTIxIDEzLjQwNTYgNDAuNTgwNkMxMy42NjUyIDQwLjg0OTEgMTQuMDE3NCA0MSAxNC4zODQ2IDQxSDM1LjYxNTRDMzUuOTgyNiA0MSAzNi4zMzQ4IDQwLjg0OTEgMzYuNTk0NCA0MC41ODA2QzM2Ljg1NDEgNDAuMzEyMSAzNyAzOS45NDc5IDM3IDM5LjU2ODJWMjEuNDMxOEMzNyAyMS4wNTIxIDM2Ljg1NDEgMjAuNjg3OSAzNi41OTQ0IDIwLjQxOTRDMzYuMzM0OCAyMC4xNTA5IDM1Ljk4MjYgMjAgMzUuNjE1NCAyMFpNMzQuMjMwOCAzMi44ODY0TDI5LjgwNTMgMjcuODk0QzI5LjcyMTYgMjcuNzk4MyAyOS42MTk4IDI3LjcyMTIgMjkuNTA2MiAyNy42Njc2QzI5LjM5MjcgMjcuNjEzOSAyOS4yNjk4IDI3LjU4NDggMjkuMTQ1IDI3LjU4MkMyOS4wMjAyIDI3LjU3OTIgMjguODk2MSAyNy42MDI4IDI4Ljc4MDQgMjcuNjUxM0MyOC42NjQ3IDI3LjY5OTggMjguNTU5OCAyNy43NzIyIDI4LjQ3MjEgMjcuODY0MUwyMy41MzYxIDMyLjk2ODRMMjguNTMzNiAzOC4xMzY0SDI1LjkyMzFMMjEuNDk4OSAzMy41NjEyQzIxLjMyNTcgMzMuMzgyMyAyMS4wOTA5IDMzLjI4MTggMjAuODQ2MiAzMy4yODE4QzIwLjYwMTQgMzMuMjgxOCAyMC4zNjY2IDMzLjM4MjMgMjAuMTkzNSAzMy41NjEyTDE1Ljc2OTIgMzguMTM2NFYyMi44NjM2SDM0LjIzMDhWMzIuODg2NFpNMTcuNzA3NyAyNy4xNTkxQzE3LjcwNzcgMjYuNzA2IDE3LjgzNzYgMjYuMjYzMSAxOC4wODExIDI1Ljg4NjNDMTguMzI0NSAyNS41MDk2IDE4LjY3MDUgMjUuMjE2IDE5LjA3NTMgMjUuMDQyNkMxOS40ODAxIDI0Ljg2OTIgMTkuOTI1NSAyNC44MjM4IDIwLjM1NTMgMjQuOTEyMkMyMC43ODUgMjUuMDAwNiAyMS4xNzk4IDI1LjIxODggMjEuNDg5NiAyNS41MzkyQzIxLjc5OTQgMjUuODU5NiAyMi4wMTA0IDI2LjI2NzggMjIuMDk1OSAyNi43MTIyQzIyLjE4MTQgMjcuMTU2NSAyMi4xMzc1IDI3LjYxNzIgMjEuOTY5OCAyOC4wMzU4QzIxLjgwMjEgMjguNDU0NCAyMS41MTgyIDI4LjgxMjIgMjEuMTUzOSAyOS4wNjM5QzIwLjc4OTYgMjkuMzE1NiAyMC4zNjEyIDI5LjQ1IDE5LjkyMzEgMjkuNDVDMTkuMzM1NSAyOS40NSAxOC43NzIgMjkuMjA4NiAxOC4zNTY2IDI4Ljc3OUMxNy45NDExIDI4LjM0OTQgMTcuNzA3NyAyNy43NjY3IDE3LjcwNzcgMjcuMTU5MVoiIGZpbGw9IiNCNUI1QjUiLz4KPC9zdmc+Cg==";
const ORIGINAL_IMAGE_PREFIX = "https://image.tmdb.org/t/p/original";
const PREVIEW_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w92";
const HD_BACKDROP_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w1280";
const HD_PROFILE_IMAGE_PREFIX = "https://image.tmdb.org/t/p/h632";
const HD_POSTER_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w780";
const HD_LOGO_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w500";
const SD_BACKDROP_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w780";
const SD_PROFILE_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w185";
const SD_POSTER_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w500";
const SD_LOGO_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w300";
const LQ_BACKDROP_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w300";
const LQ_POSTER_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w342";
const LQ_PROFILE_IMAGE_PREFIX = "https://image.tmdb.org/t/p/w185";
export const IMAGE_PREFIX = {
	ORIGINAL: ORIGINAL_IMAGE_PREFIX,
	PREVIEW: PREVIEW_IMAGE_PREFIX,
	HD_POSTER: HD_POSTER_IMAGE_PREFIX,
	HD_BACKDROP: HD_BACKDROP_IMAGE_PREFIX,
	HD_PROFILE: HD_PROFILE_IMAGE_PREFIX,
	HD_LOGO: HD_LOGO_IMAGE_PREFIX,
	SD_POSTER: SD_POSTER_IMAGE_PREFIX,
	SD_BACKDROP: SD_BACKDROP_IMAGE_PREFIX,
	SD_PROFILE: SD_PROFILE_IMAGE_PREFIX,
	SD_LOGO: SD_LOGO_IMAGE_PREFIX,
	LQ_POSTER: LQ_POSTER_IMAGE_PREFIX,
	LQ_BACKDROP: LQ_BACKDROP_IMAGE_PREFIX,
	LQ_PROFILE: LQ_PROFILE_IMAGE_PREFIX,
};
