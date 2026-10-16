import {
  API_BASE,
  DEFAULT_LANG,
  DEFAULT_LIMIT,
  DEFAULT_RATING,
  GIPHY_API_KEY
} from '@/config/api'
import { getJson } from './http'
import type { Category, GifItem, GifsResponse, GiphyGif, GiphyResponse } from './types'

// GIPHY rejects offsets above this value
const MAX_OFFSET = 4999

/**
 * Build a GIPHY endpoint URL safely using the URL API.
 */
function buildUrl(endpoint: 'trending' | 'search', params: {
  query?: string
  offset?: string | null
  limit?: number
}): string {
  const url = new URL(`${API_BASE}/${endpoint}`)
  url.searchParams.set('api_key', GIPHY_API_KEY)
  url.searchParams.set('limit', String(params.limit ?? DEFAULT_LIMIT))
  url.searchParams.set('rating', DEFAULT_RATING)
  if (endpoint === 'search') url.searchParams.set('lang', DEFAULT_LANG)
  if (params.query?.trim()) url.searchParams.set('q', params.query.trim())
  if (params.offset) url.searchParams.set('offset', params.offset)
  return url.toString()
}

function toGifItem(gif: GiphyGif): GifItem | null {
  const url = (gif.images.fixed_height ?? gif.images.downsized ?? gif.images.original)?.url
  return url ? { id: gif.id, title: gif.title, url } : null
}

/**
 * Convert a GIPHY response to the app's shape.
 * `next` is the offset of the following page, or null when there is nothing more.
 */
function normalize(res: GiphyResponse | null): GifsResponse | null {
  if (!res || !Array.isArray(res.data)) return null
  const { offset, count, total_count } = res.pagination
  const nextOffset = offset + count
  const hasMore = count > 0 && nextOffset < total_count && nextOffset <= MAX_OFFSET
  return {
    results: res.data.map(toGifItem).filter((g): g is GifItem => g !== null),
    next: hasMore ? String(nextOffset) : null
  }
}

/** Fetch trending GIFs */
export async function fetchTrending(
  offset: string | null,
  opts?: { signal?: AbortSignal }
) {
  return normalize(await getJson<GiphyResponse>(buildUrl('trending', { offset }), opts))
}

/** Fetch search results */
export async function fetchSearch(
  query: string | undefined,
  offset: string | null,
  opts?: { signal?: AbortSignal }
) {
  return normalize(await getJson<GiphyResponse>(buildUrl('search', { query, offset }), opts))
}

export async function fetchGifsFromApi(
  args: { category?: Category; query?: string; offset?: string | null },
  opts?: { signal?: AbortSignal }
): Promise<GifsResponse | null> {
  const { category, query, offset } = args ?? {}

  if (!GIPHY_API_KEY) {
    console.error('[GIPHY] Missing VITE_GIPHY_API_KEY in .env.local')
    return null
  }

  if (category === 'trends') return fetchTrending(offset ?? null, opts)
  if (category === 'search') return fetchSearch(query, offset ?? null, opts)

  return null
}
