import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Film Fanatic',
    short_name: 'Film Fanatic',
    description:
      'Explore a vast collection of movies and TV shows with Film Fanatic. Get detailed information, ratings, and reviews for your favorite films and series.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0a08',
    theme_color: '#0b0a08',
    orientation: 'portrait',
    categories: [
      'movie database',
      'film reviews',
      'TV show information',
      'movie ratings',
      'entertainment',
    ],
    lang: 'en-US',
    icons: [
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: 'https://ik.imagekit.io/swastikdan/Film-Fanatic/public/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: 'https://ik.imagekit.io/swastikdan/Film-Fanatic/public/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: 'https://ik.imagekit.io/swastikdan/Film-Fanatic/public/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
    ],
  }
}
