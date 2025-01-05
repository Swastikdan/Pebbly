'use server';
const accessToken = process.env.TMDB_ACCESS_TOKEN!;
const baseUrl = process.env.TMDB_API_URL!;
const method = 'GET';

interface FetchTmdbDataResult<T> {
  data?: T;
  error?: string;
}

export async function Tmdb<T>(url: string): Promise<FetchTmdbDataResult<T>> {
  const fetchUrl = `${baseUrl}${url}`;
  const options = {
    method,
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  };

  try {
    const response = await fetch(fetchUrl, options);
    if (!response.ok) {
      return { error: `Error: ${response.status} ${response.statusText}` };
    }
    const data = await response.json();
    return { data };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    } else {
      return { error: 'An unknown error occurred' };
    }
  }
}
