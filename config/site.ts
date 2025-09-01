export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Film Fanatic",
  description:
    "Explore a vast collection of movies and TV shows with Film Fanatic.",
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
