import { API_PROXY_PATH } from '@/config/api'
import { getJson, type HttpError, type Result } from './http'
import type { Category, GifItem, GifsResponse, GiphyGif, GiphyResponse } from './types'

// GIPHY rejects offsets above this value
const MAX_OFFSET = 4999

/**
 * Build a URL for the GIPHY proxy (netlify/functions/gifs/gifs.ts).
 * The proxy adds the API key, limit, rating and lang.
 */
function buildProxyUrl(
  endpoint: 'trending' | 'search',
  params: { query?: string; offset?: string | null }
): string {
  const search = new URLSearchParams({ endpoint })
  if (params.query?.trim()) search.set('q', params.query.trim())
  if (params.offset) search.set('offset', params.offset)
  return `${API_PROXY_PATH}?${search}`
}

function toGifItem(gif: GiphyGif): GifItem | null {
  const url = (gif.images.fixed_height ?? gif.images.downsized ?? gif.images.original)?.url
  return url ? { id: gif.id, title: gif.title, url } : null
}

/**
 * Convert a GIPHY response to the app's shape.
 * `next` is the offset of the following page, or null when there is nothing more.
 */
export function normalize(res: GiphyResponse | null): GifsResponse | null {
  if (!res || !Array.isArray(res.data)) return null
  const { offset, count, total_count } = res.pagination
  const nextOffset = offset + count
  const hasMore = count > 0 && nextOffset < total_count && nextOffset <= MAX_OFFSET
  return {
    results: res.data.map(toGifItem).filter((g): g is GifItem => g !== null),
    next: hasMore ? String(nextOffset) : null
  }
}

export type GifsError = HttpError | { kind: 'invalid' }

type GifsResult = Result<GifsResponse, GifsError>

function toGifsResult(res: Result<GiphyResponse>): GifsResult {
  if (!res.ok) return res
  try {
    const data = normalize(res.data)
    return data ? { ok: true, data } : { ok: false, error: { kind: 'invalid' } }
  } catch {
    return { ok: false, error: { kind: 'invalid' } }
  }
}

/** Fetch trending GIFs */
export async function fetchTrending(
  offset: string | null,
  opts?: { signal?: AbortSignal }
): Promise<GifsResult> {
  return toGifsResult(await getJson<GiphyResponse>(buildProxyUrl('trending', { offset }), opts))
}

/** Fetch search results */
export async function fetchSearch(
  query: string | undefined,
  offset: string | null,
  opts?: { signal?: AbortSignal }
): Promise<GifsResult> {
  return toGifsResult(
    await getJson<GiphyResponse>(buildProxyUrl('search', { query, offset }), opts)
  )
}

export async function fetchGifsFromApi(
  args: { category?: Category; query?: string; offset?: string | null },
  opts?: { signal?: AbortSignal }
): Promise<GifsResult> {
  const { category, query, offset } = args ?? {}

  if (category === 'trends') return fetchTrending(offset ?? null, opts)
  if (category === 'search') return fetchSearch(query, offset ?? null, opts)

  return { ok: false, error: { kind: 'invalid' } }
}
