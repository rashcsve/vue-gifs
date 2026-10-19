import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE, DEFAULT_LANG, DEFAULT_LIMIT, DEFAULT_RATING } from '@/config/api'
import { buildUrl, fetchGifsFromApi, normalize } from '@/services/giphy'
import type { GiphyGif, GiphyResponse } from '@/services/types'
import type * as ApiConfig from '@/config/api'
import { jsonResponse } from '@/test/helpers'

const apiConfig = vi.hoisted(() => ({ key: 'test-key' }))

vi.mock('@/config/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiConfig>()
  return {
    ...actual,
    get GIPHY_API_KEY() {
      return apiConfig.key
    }
  }
})

function parse(url: string) {
  return new URL(url)
}

function gif(id: string, images: GiphyGif['images'] = {}): GiphyGif {
  return { id, title: `Title ${id}`, images }
}

function response(
  data: GiphyGif[],
  pagination: GiphyResponse['pagination'] = {
    offset: 0,
    count: data.length,
    total_count: 100
  }
): GiphyResponse {
  return { data, pagination, meta: { status: 200, msg: 'OK' } }
}

describe('buildUrl', () => {
  it('uses the trending endpoint path', () => {
    const url = parse(buildUrl('trending', {}))
    expect(`${url.origin}${url.pathname}`).toBe(`${API_BASE}/trending`)
  })

  it('uses the search endpoint path', () => {
    const url = parse(buildUrl('search', { query: 'cats' }))
    expect(`${url.origin}${url.pathname}`).toBe(`${API_BASE}/search`)
  })

  it('sets api_key from config, default limit and rating', () => {
    const { searchParams } = parse(buildUrl('trending', {}))
    expect(searchParams.get('api_key')).toBe('test-key')
    expect(searchParams.get('limit')).toBe(String(DEFAULT_LIMIT))
    expect(searchParams.get('rating')).toBe(DEFAULT_RATING)
  })

  it('uses a custom limit when given', () => {
    const { searchParams } = parse(buildUrl('trending', { limit: 30 }))
    expect(searchParams.get('limit')).toBe('30')
  })

  it('sets lang only for search', () => {
    expect(parse(buildUrl('search', { query: 'cats' })).searchParams.get('lang')).toBe(DEFAULT_LANG)
    expect(parse(buildUrl('trending', {})).searchParams.has('lang')).toBe(false)
  })

  it('trims the query', () => {
    const { searchParams } = parse(buildUrl('search', { query: '  funny cats  ' }))
    expect(searchParams.get('q')).toBe('funny cats')
  })

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   ']
  ])('omits q when the query is %s', (_label, query) => {
    const { searchParams } = parse(buildUrl('search', { query }))
    expect(searchParams.has('q')).toBe(false)
  })

  it('sets offset when given', () => {
    const { searchParams } = parse(buildUrl('trending', { offset: '24' }))
    expect(searchParams.get('offset')).toBe('24')
  })

  it('omits offset when null', () => {
    const { searchParams } = parse(buildUrl('trending', { offset: null }))
    expect(searchParams.has('offset')).toBe(false)
  })
})

describe('normalize', () => {
  it('returns null for null input', () => {
    expect(normalize(null)).toBeNull()
  })

  it('returns null when data is not an array', () => {
    const bad: GiphyResponse = JSON.parse(
      '{"data":{},"pagination":{"offset":0,"count":0,"total_count":0},"meta":{"status":200,"msg":"OK"}}'
    )
    expect(normalize(bad)).toBeNull()
  })

  it('maps GIFs to id, title and url', () => {
    const res = normalize(response([gif('a', { fixed_height: { url: 'https://x/a.gif' } })]))
    expect(res?.results).toEqual([{ id: 'a', title: 'Title a', url: 'https://x/a.gif' }])
  })

  it('falls back fixed_height -> downsized -> original for the image url', () => {
    const res = normalize(
      response([
        gif('fh', {
          fixed_height: { url: 'fh.gif' },
          downsized: { url: 'ds.gif' },
          original: { url: 'or.gif' }
        }),
        gif('ds', { downsized: { url: 'ds.gif' }, original: { url: 'or.gif' } }),
        gif('or', { original: { url: 'or.gif' } })
      ])
    )
    expect(res?.results.map((g) => g.url)).toEqual(['fh.gif', 'ds.gif', 'or.gif'])
  })

  it('drops GIFs without an image url', () => {
    const res = normalize(
      response([
        gif('none'),
        gif('empty', { fixed_height: { url: '' } }),
        gif('ok', { original: { url: 'ok.gif' } })
      ])
    )
    expect(res?.results.map((g) => g.id)).toEqual(['ok'])
  })

  it('sets next to offset + count when more results remain', () => {
    const res = normalize(response([], { offset: 12, count: 12, total_count: 100 }))
    expect(res?.next).toBe('24')
  })

  it('sets next to null when nextOffset reaches total_count', () => {
    expect(normalize(response([], { offset: 88, count: 12, total_count: 100 }))?.next).toBeNull()
    expect(normalize(response([], { offset: 90, count: 12, total_count: 100 }))?.next).toBeNull()
  })

  it('sets next to null for an empty page (count 0)', () => {
    const res = normalize(response([], { offset: 0, count: 0, total_count: 100 }))
    expect(res).toEqual({ results: [], next: null })
  })

  it('sets next to null when nextOffset is above the 4999 cap', () => {
    const res = normalize(response([], { offset: 4992, count: 12, total_count: 100000 }))
    expect(res?.next).toBeNull()
  })

  it('allows nextOffset exactly 4999 when total allows', () => {
    const res = normalize(response([], { offset: 4987, count: 12, total_count: 100000 }))
    expect(res?.next).toBe('4999')
  })
})

describe('fetchGifsFromApi', () => {
  const fetchMock = vi.fn<typeof fetch>()

  function calledUrl(): URL {
    const input = fetchMock.mock.calls[0]?.[0]
    return new URL(String(input))
  }

  beforeEach(() => {
    apiConfig.key = 'test-key'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    apiConfig.key = 'test-key'
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches trending and returns ok with the normalized page', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        response([gif('a', { fixed_height: { url: 'a.gif' } })], {
          offset: 0,
          count: 1,
          total_count: 100
        })
      )
    )
    const result = await fetchGifsFromApi({ category: 'trends', offset: null })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = calledUrl()
    expect(`${url.origin}${url.pathname}`).toBe(`${API_BASE}/trending`)
    expect(url.searchParams.has('offset')).toBe(false)
    expect(result).toEqual({
      ok: true,
      data: { results: [{ id: 'a', title: 'Title a', url: 'a.gif' }], next: '1' }
    })
  })

  it('fetches search with the query and offset', async () => {
    fetchMock.mockResolvedValue(jsonResponse(response([])))
    const result = await fetchGifsFromApi({ category: 'search', query: 'cats', offset: '24' })

    const url = calledUrl()
    expect(`${url.origin}${url.pathname}`).toBe(`${API_BASE}/search`)
    expect(url.searchParams.get('q')).toBe('cats')
    expect(url.searchParams.get('offset')).toBe('24')
    expect(result).toEqual({ ok: true, data: { results: [], next: null } })
  })

  it('returns a config error without calling fetch when the API key is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    apiConfig.key = ''
    const result = await fetchGifsFromApi({ category: 'trends' })

    expect(result).toEqual({ ok: false, error: { kind: 'config' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns an invalid error without calling fetch when the category is missing', async () => {
    const result = await fetchGifsFromApi({ query: 'cats' })

    expect(result).toEqual({ ok: false, error: { kind: 'invalid' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns an invalid error when the response data is not an array', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '{"data":{},"pagination":{"offset":0,"count":0,"total_count":0},"meta":{"status":200,"msg":"OK"}}',
        { status: 200 }
      )
    )
    const result = await fetchGifsFromApi({ category: 'trends' })
    expect(result).toEqual({ ok: false, error: { kind: 'invalid' } })
  })

  it('returns an invalid error when pagination is missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))

    await expect(fetchGifsFromApi({ category: 'trends' })).resolves.toEqual({
      ok: false,
      error: { kind: 'invalid' }
    })
  })

  it('propagates HTTP errors from the HTTP layer as-is', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' })
    )
    const result = await fetchGifsFromApi({ category: 'search', query: 'cats' })
    expect(result).toEqual({
      ok: false,
      error: { kind: 'http', status: 403, statusText: 'Forbidden' }
    })
  })

  it('propagates an aborted request as an aborted error', async () => {
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    const result = await fetchGifsFromApi({ category: 'trends' })
    expect(result).toEqual({ ok: false, error: { kind: 'aborted' } })
  })

  it('passes the abort signal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse(response([])))
    const controller = new AbortController()
    await fetchGifsFromApi({ category: 'trends' }, { signal: controller.signal })

    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { signal: controller.signal })
  })
})
