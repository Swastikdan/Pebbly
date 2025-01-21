import { cache } from 'react'
//import 'server-only'

const accessToken = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN!
const baseUrl = process.env.NEXT_PUBLIC_TMDB_API_URL!
const method = 'GET'

interface FetchTmdbDataResult<T> {
  data?: T
  error?: string
}

export const Tmdb = cache(async function UncachedTmdb<T>(
  url: string,
): Promise<FetchTmdbDataResult<T>> {
  const fetchUrl = `${baseUrl}${url}`

  const options = {
    method,
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'force-cache' as RequestCache,
    next: {
      tags: ['tmdb', url],
      revalidate: 3600,
    },
  }

  try {
    const response = await fetch(fetchUrl, options)
    if (!response.ok) {
      return { error: `Error: ${response.status} ${response.statusText}` }
    }
    const data = await response.json()
    return { data }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'An unknown error occurred' }
  }
})
