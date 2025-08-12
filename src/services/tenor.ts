import { API_BASE, DEFAULT_LIMIT, DEFAULT_LOCALE, TENOR_API_KEY } from '@/config/api'
import { getJson } from './http'
import type { Category, GifsResponse } from './types'


/**
 * Build a Tenor endpoint URL safely using the URL API.
 */
function buildUrl(endpoint: 'trending' | 'search', params: {
  query?: string
  offset?: string | null
  limit?: number
  locale?: string
  key?: string
}): string {
  const url = new URL(`${API_BASE}/${endpoint}`)
  url.searchParams.set('key', params.key ?? TENOR_API_KEY)
  url.searchParams.set('locale', params.locale ?? DEFAULT_LOCALE)
  url.searchParams.set('limit', String(params.limit ?? DEFAULT_LIMIT))
  if (params.query?.trim()) url.searchParams.set('q', params.query.trim())
  if (params.offset) url.searchParams.set('pos', params.offset)
  return url.toString()
}

/** Fetch trending GIFs */
export function fetchTrending(
  offset: string | null,
  opts?: { signal?: AbortSignal }
) {
  return getJson<GifsResponse>(buildUrl('trending', { offset }), opts)
}

/** Fetch search results */
export function fetchSearch(
  query: string | undefined,
  offset: string | null,
  opts?: { signal?: AbortSignal }
) {
  return getJson<GifsResponse>(buildUrl('search', { query, offset }), opts)
}

export async function fetchGifsFromApi(
  args: { category?: Category; query?: string; offset?: string | null },
  opts?: { signal?: AbortSignal }
): Promise<GifsResponse | null> {
  const { category, query, offset } = args ?? {}

  if (category === 'trends') return fetchTrending(offset ?? null, opts)
  if (category === 'search') return fetchSearch(query, offset ?? null, opts)

  return null
}