import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_PROXY_PATH } from '@/config/api'
import { fetchGifsFromApi, normalize } from '@/services/giphy'
import type { GiphyGif, GiphyResponse } from '@/services/types'
import { jsonResponse } from '@/test/helpers'

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
    return new URL(String(input), 'http://localhost')
  }

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
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
    const input = String(fetchMock.mock.calls[0]?.[0])
    expect(input.startsWith(`${API_PROXY_PATH}?`)).toBe(true)
    const url = calledUrl()
    expect(url.pathname).toBe('/api/gifs')
    expect(url.searchParams.get('endpoint')).toBe('trending')
    expect(url.searchParams.has('q')).toBe(false)
    expect(url.searchParams.has('offset')).toBe(false)
    expect(url.searchParams.has('api_key')).toBe(false)
    expect(result).toEqual({
      ok: true,
      data: { results: [{ id: 'a', title: 'Title a', url: 'a.gif' }], next: '1' }
    })
  })

  it('fetches search with the query and offset', async () => {
    fetchMock.mockResolvedValue(jsonResponse(response([])))
    const result = await fetchGifsFromApi({ category: 'search', query: 'cats', offset: '24' })

    const url = calledUrl()
    expect(url.pathname).toBe('/api/gifs')
    expect(url.searchParams.get('endpoint')).toBe('search')
    expect(url.searchParams.get('q')).toBe('cats')
    expect(url.searchParams.get('offset')).toBe('24')
    expect(url.searchParams.has('api_key')).toBe(false)
    expect(result).toEqual({ ok: true, data: { results: [], next: null } })
  })

  it('trims the search query and omits q when it is blank', async () => {
    fetchMock.mockResolvedValue(jsonResponse(response([])))
    await fetchGifsFromApi({ category: 'search', query: '  funny cats  ' })
    expect(calledUrl().searchParams.get('q')).toBe('funny cats')

    fetchMock.mockClear()
    fetchMock.mockResolvedValue(jsonResponse(response([])))
    await fetchGifsFromApi({ category: 'search', query: '   ' })
    expect(calledUrl().searchParams.has('q')).toBe(false)
  })

  it('leaves limit, rating and lang to the server', async () => {
    fetchMock.mockResolvedValue(jsonResponse(response([])))
    await fetchGifsFromApi({ category: 'search', query: 'cats' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const { searchParams } = calledUrl()
    expect(searchParams.has('limit')).toBe(false)
    expect(searchParams.has('rating')).toBe(false)
    expect(searchParams.has('lang')).toBe(false)
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
