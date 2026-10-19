// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE, DEFAULT_LANG, DEFAULT_LIMIT, DEFAULT_RATING } from '../../../src/config/api'
import { jsonResponse } from '../../../src/test/helpers'
import { buildGiphyUrl, config, handleGifs } from './gifs'

const KEY = 'secret-test-key'

function parse(url: string) {
  return new URL(url)
}

function req(search: string, init?: RequestInit): Request {
  return new Request(`http://localhost/api/gifs${search}`, init)
}

describe('buildGiphyUrl', () => {
  it('uses the trending endpoint path', () => {
    const url = parse(buildGiphyUrl('trending', {}, KEY))
    expect(`${url.origin}${url.pathname}`).toBe(`${API_BASE}/trending`)
  })

  it('uses the search endpoint path', () => {
    const url = parse(buildGiphyUrl('search', { query: 'cats' }, KEY))
    expect(`${url.origin}${url.pathname}`).toBe(`${API_BASE}/search`)
  })

  it('sets api_key from the argument, default limit and rating', () => {
    const { searchParams } = parse(buildGiphyUrl('trending', {}, KEY))
    expect(searchParams.get('api_key')).toBe(KEY)
    expect(searchParams.get('limit')).toBe(String(DEFAULT_LIMIT))
    expect(searchParams.get('rating')).toBe(DEFAULT_RATING)
  })

  it('uses a custom limit when given', () => {
    const { searchParams } = parse(buildGiphyUrl('trending', { limit: 30 }, KEY))
    expect(searchParams.get('limit')).toBe('30')
  })

  it('sets lang only for search', () => {
    expect(parse(buildGiphyUrl('search', { query: 'cats' }, KEY)).searchParams.get('lang')).toBe(
      DEFAULT_LANG
    )
    expect(parse(buildGiphyUrl('trending', {}, KEY)).searchParams.has('lang')).toBe(false)
  })

  it('trims the query', () => {
    const { searchParams } = parse(buildGiphyUrl('search', { query: '  funny cats  ' }, KEY))
    expect(searchParams.get('q')).toBe('funny cats')
  })

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   ']
  ])('omits q when the query is %s', (_label, query) => {
    const { searchParams } = parse(buildGiphyUrl('search', { query }, KEY))
    expect(searchParams.has('q')).toBe(false)
  })

  it('sets offset when given', () => {
    const { searchParams } = parse(buildGiphyUrl('trending', { offset: '24' }, KEY))
    expect(searchParams.get('offset')).toBe('24')
  })

  it('omits offset when null', () => {
    const { searchParams } = parse(buildGiphyUrl('trending', { offset: null }, KEY))
    expect(searchParams.has('offset')).toBe(false)
  })
})

describe('config', () => {
  it('serves the function at /api/gifs', () => {
    expect(config.path).toBe('/api/gifs')
  })
})

describe('handleGifs', () => {
  const fetchMock = vi.fn<typeof fetch>()

  function calledUrl(): URL {
    const input = fetchMock.mock.calls[0]?.[0]
    return new URL(String(input))
  }

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('proxies trending to GIPHY with the server key and returns the upstream JSON', async () => {
    const body = { data: [], pagination: { offset: 0, count: 0, total_count: 0 } }
    fetchMock.mockResolvedValue(jsonResponse(body))

    const res = await handleGifs(req('?endpoint=trending'), KEY)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = calledUrl()
    expect(`${url.origin}${url.pathname}`).toBe(`${API_BASE}/trending`)
    expect(url.searchParams.get('api_key')).toBe(KEY)
    expect(url.searchParams.get('limit')).toBe(String(DEFAULT_LIMIT))
    expect(url.searchParams.get('rating')).toBe(DEFAULT_RATING)
    expect(url.searchParams.has('offset')).toBe(false)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual(body)
  })

  it('proxies search with the trimmed query and offset', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))

    const res = await handleGifs(req('?endpoint=search&q=%20cats%20&offset=24'), KEY)

    const url = calledUrl()
    expect(`${url.origin}${url.pathname}`).toBe(`${API_BASE}/search`)
    expect(url.searchParams.get('q')).toBe('cats')
    expect(url.searchParams.get('offset')).toBe('24')
    expect(url.searchParams.get('lang')).toBe(DEFAULT_LANG)
    expect(res.status).toBe(200)
  })

  it('omits q upstream when the search query is missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))

    await handleGifs(req('?endpoint=search'), KEY)

    expect(calledUrl().searchParams.has('q')).toBe(false)
  })

  it('forwards the request abort signal to the upstream fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))
    const controller = new AbortController()
    const request = req('?endpoint=trending', { signal: controller.signal })

    await handleGifs(request, KEY)

    const signal = fetchMock.mock.calls[0]?.[1]?.signal
    expect(signal).toBe(request.signal)
    controller.abort()
    expect(signal?.aborted).toBe(true)
  })

  it('ignores client-supplied api_key, limit and rating', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))

    await handleGifs(req('?endpoint=trending&api_key=evil&limit=500&rating=r'), KEY)

    const { searchParams } = calledUrl()
    expect(searchParams.getAll('api_key')).toEqual([KEY])
    expect(searchParams.get('limit')).toBe(String(DEFAULT_LIMIT))
    expect(searchParams.get('rating')).toBe(DEFAULT_RATING)
  })

  it.each(['POST', 'PUT', 'DELETE'])('returns 405 for %s without calling fetch', async (method) => {
    const res = await handleGifs(req('?endpoint=trending', { method }), KEY)

    expect(res.status).toBe(405)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['undefined', undefined],
    ['empty', '']
  ])(
    'returns 500 { error: "config" } and logs when the key is %s, without calling fetch',
    async (_label, apiKey) => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await handleGifs(req('?endpoint=trending'), apiKey)

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'config' })
      expect(errorSpy).toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['missing', ''],
    ['unknown', '?endpoint=random'],
    ['empty', '?endpoint='],
    ['a path', '?endpoint=../trending']
  ])('returns 400 without calling fetch when endpoint is %s', async (_label, search) => {
    const res = await handleGifs(req(search), KEY)

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['negative', '-1'],
    ['non-numeric', 'abc'],
    ['decimal', '1.5'],
    ['empty', ''],
    ['with spaces', '%2012']
  ])('returns 400 without calling fetch when offset is %s', async (_label, offset) => {
    const res = await handleGifs(req(`?endpoint=trending&offset=${offset}`), KEY)

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes an upstream error status and body through', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'Invalid authentication credentials' }, { status: 403 })
    )

    const res = await handleGifs(req('?endpoint=trending'), KEY)

    expect(res.status).toBe(403)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ message: 'Invalid authentication credentials' })
    expect(text).not.toContain(KEY)
  })

  it('returns 502 without leaking the key when the upstream fetch rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new TypeError(`fetch failed for ${API_BASE}?api_key=${KEY}`))

    const res = await handleGifs(req('?endpoint=trending'), KEY)

    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain(KEY)
  })

  it('returns 502 without leaking the key when the upstream body fails to read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new TypeError(`terminated for ${API_BASE}?api_key=${KEY}`))
      }
    })
    fetchMock.mockResolvedValue(new Response(body, { status: 200 }))

    const res = await handleGifs(req('?endpoint=trending'), KEY)

    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain(KEY)
  })
})
