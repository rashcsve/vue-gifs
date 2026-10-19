// GIPHY proxy: the browser calls /api/gifs, this adds the API key server-side.
// Runs as a Netlify function in production and as Vite middleware in dev/preview (vite.config.ts).
// Subfolder layout: only gifs.ts is a function entry, so the spec next to it isn't deployed.
// Relative import: Netlify bundles functions without the `@/` alias.
import { API_BASE, DEFAULT_LANG, DEFAULT_LIMIT, DEFAULT_RATING } from '../../../src/config/api'

type Endpoint = 'trending' | 'search'

const ENDPOINTS: readonly string[] = ['trending', 'search'] satisfies Endpoint[]

function isEndpoint(value: string | null): value is Endpoint {
  return value !== null && ENDPOINTS.includes(value)
}

/**
 * Build a GIPHY endpoint URL safely using the URL API.
 */
export function buildGiphyUrl(
  endpoint: Endpoint,
  params: {
    query?: string
    offset?: string | null
    limit?: number
  },
  apiKey: string
): string {
  const url = new URL(`${API_BASE}/${endpoint}`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('limit', String(params.limit ?? DEFAULT_LIMIT))
  url.searchParams.set('rating', DEFAULT_RATING)
  if (endpoint === 'search') url.searchParams.set('lang', DEFAULT_LANG)
  if (params.query?.trim()) url.searchParams.set('q', params.query.trim())
  if (params.offset) url.searchParams.set('offset', params.offset)
  return url.toString()
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status })
}

/**
 * Validate the request, forward it to GIPHY with `apiKey`, and return GIPHY's status and body.
 * Only `endpoint`, `q` and `offset` are read from the request; the server sets everything else.
 */
export async function handleGifs(req: Request, apiKey: string | undefined): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method' }, 405)

  if (!apiKey) {
    console.error('[gifs] Missing GIPHY_API_KEY (formerly VITE_GIPHY_API_KEY) in .env.local')
    return json({ error: 'config' }, 500)
  }

  const params = new URL(req.url).searchParams
  const endpoint = params.get('endpoint')
  const offset = params.get('offset')
  if (!isEndpoint(endpoint) || (offset !== null && !/^\d+$/.test(offset))) {
    return json({ error: 'invalid' }, 400)
  }

  try {
    const upstream = await fetch(
      buildGiphyUrl(endpoint, { query: params.get('q') ?? undefined, offset }, apiKey),
      // A cancelled client request (debounce, route change) cancels the GIPHY call too
      { signal: req.signal }
    )
    // Read the body here too: the connection can drop mid-body
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' }
    })
  } catch {
    // The error can contain the upstream URL (and so the key): log nothing from it
    console.error('[gifs] GIPHY request failed')
    return json({ error: 'upstream' }, 502)
  }
}

export default (req: Request) => handleGifs(req, process.env.GIPHY_API_KEY)

export const config = { path: '/api/gifs' }
