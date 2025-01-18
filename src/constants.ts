const NAV_ITEMS = [
  {
    name: 'Movies',
    slug: 'movies',
    submenu: [
      { name: 'Popular', url: '/list/movies/popular', slug: 'popular' },
      {
        name: 'Now Playing',
        url: '/list/movies/now-playing',
        slug: 'now-playing',
      },
      { name: 'Top Rated', url: '/list/movies/top-rated', slug: 'top-rated' },
      { name: 'Upcoming', url: '/list/movies/upcoming', slug: 'upcoming' },
    ],
  },
  {
    name: 'TV Shows',
    slug: 'tv-shows',
    submenu: [
      { name: 'Popular', url: '/list/tv-shows/popular', slug: 'popular' },
      {
        name: 'On The Air',
        url: '/list/tv-shows/on-the-air',
        slug: 'on-the-air',
      },
      { name: 'Top Rated', url: '/list/tv-shows/top-rated', slug: 'top-rated' },
      {
        name: 'Airing Today',
        url: '/list/tv-shows/airing-today',
        slug: 'airing-today',
      },
    ],
  },
  {
    name: 'People',
    slug: 'peoples',
    submenu: [
      { name: 'Popular', url: '/list/peoples/popular', slug: 'popular' },
    ],
  },
]

type MediaPageSlug = {
  type: 'movies' | 'tv-shows' | 'peoples'
  slug:
    | 'popular'
    | 'now-playing'
    | 'top-rated'
    | 'upcoming'
    | 'on-the-air'
    | 'airing-today'
}

const MEDIA_PAGE_SLUGS: MediaPageSlug[] = NAV_ITEMS.flatMap((item) =>
  item.submenu.map((subItem) => ({
    type: item.slug as 'movies' | 'tv-shows' | 'peoples',
    slug: subItem.slug as MediaPageSlug['slug'],
  })),
)

const GENRE_LIST = [
  { id: 28, name: '🏃‍♂️ Action' },
  { id: 12, name: '🎒 Adventure' },
  { id: 16, name: '🖌️ Animation' },
  { id: 35, name: '🤪 Comedy' },
  { id: 80, name: '🚨 Crime' },
  { id: 99, name: '📹 Documentary' },
  { id: 18, name: '🎭 Drama' },
  { id: 10751, name: '🏠 Family' },
  { id: 14, name: '🦄 Fantasy' },
  { id: 36, name: '🏛️ History' },
  { id: 27, name: '👻 Horror' },
  { id: 10402, name: '🎵 Music' },
  { id: 9648, name: '🕵️‍♂️Mystery' },
  { id: 10749, name: '💘 Romance' },
  { id: 878, name: '🤖 Science Fiction' },
  { id: 10770, name: '📺 TV Movie' },
  { id: 53, name: '🔪 Thriller' },
  { id: 10752, name: '⚔️ War' },
  { id: 37, name: '🤠 Western' },
  { id: 10759, name: '🎬 Action & Adventure' },
  { id: 10762, name: '🧸 Kids' },
  { id: 10763, name: '📰 News' },
  { id: 10764, name: '🎥 Reality' },
  { id: 10765, name: '👽 Sci-Fi & Fantasy' },
  { id: 10766, name: '🧼 Soap' },
  { id: 10767, name: '🎤 Talk' },
  { id: 10768, name: '⚔️ War & Politics' },
].map((genre) => ({ ...genre, id: genre.id }))

const ORIGINAL_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/original'
const PREVIEW_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/w92'
// const HD_BACKDROP_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/w1280'
// const HD_PROFILE_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/h632'
// const HD_POSTER_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/w780'
// const SD_BACKDROP_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/w780'
// const SD_PROFILE_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/w185'
// const SD_POSTER_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/w500'
// const LQ_BACKDROP_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/w300'
// const LQ_POSTER_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/w342'

const HD_POSTER_IMAGE_PREFIX =
  'https://media2.dev.to/dynamic/image/width=780,height=,fit=scale-down,gravity=auto,pr-true,format=auto/https://image.tmdb.org/t/p/w780'

const HD_BACKDROP_IMAGE_PREFIX =
  'https://media2.dev.to/dynamic/image/width=1280,height=,fit=scale-down,gravity=auto,pr-true,format=auto/https://image.tmdb.org/t/p/w1280'
const HD_PROFILE_IMAGE_PREFIX =
  'https://media2.dev.to/dynamic/image/width=632,height=,fit=scale-down,gravity=auto,pr-true,format=auto/https://image.tmdb.org/t/p/h632'

const SD_POSTER_IMAGE_PREFIX =
  'https://media2.dev.to/dynamic/image/width=500,height=,fit=scale-down,gravity=auto,pr-true,format=auto/https://image.tmdb.org/t/p/w500'

const SD_BACKDROP_IMAGE_PREFIX =
  'https://media2.dev.to/dynamic/image/width=780,height=,fit=scale-down,gravity=auto,pr-true,format=auto/https://image.tmdb.org/t/p/w780'

const SD_PROFILE_IMAGE_PREFIX =
  'https://media2.dev.to/dynamic/image/width=185,height=,fit=scale-down,gravity=auto,pr-true,format=auto/https://image.tmdb.org/t/p/w185'

const LQ_POSTER_IMAGE_PREFIX =
  'https://media2.dev.to/dynamic/image/width=342,height=,fit=scale-down,gravity=auto,pr-true,format=auto/https://image.tmdb.org/t/p/w342'

const LQ_BACKDROP_IMAGE_PREFIX =
  'https://media2.dev.to/dynamic/image/width=300,height=,fit=scale-down,gravity=auto,pr-true,format=auto/https://image.tmdb.org/t/p/w300'

const IMAGE_PREFIX = {
  ORIGINAL: ORIGINAL_IMAGE_PREFIX,
  PREVIEW: PREVIEW_IMAGE_PREFIX,
  HD_POSTER: HD_POSTER_IMAGE_PREFIX,
  HD_BACKDROP: HD_BACKDROP_IMAGE_PREFIX,
  HD_PROFILE: HD_PROFILE_IMAGE_PREFIX,
  SD_POSTER: SD_POSTER_IMAGE_PREFIX,
  SD_BACKDROP: SD_BACKDROP_IMAGE_PREFIX,
  SD_PROFILE: SD_PROFILE_IMAGE_PREFIX,
  LQ_POSTER: LQ_POSTER_IMAGE_PREFIX,
  LQ_BACKDROP: LQ_BACKDROP_IMAGE_PREFIX,
}

const IMDB_URL = 'https://www.imdb.com/title/'

export { NAV_ITEMS, MEDIA_PAGE_SLUGS, GENRE_LIST, IMAGE_PREFIX, IMDB_URL }
