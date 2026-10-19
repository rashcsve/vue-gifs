import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getJson } from '@/services/http'
import { jsonResponse } from '@/test/helpers'

const URL_ = 'https://example.test/data'

describe('getJson', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns ok with the parsed body on a 2xx response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ hello: 'world' }))
    const result = await getJson<{ hello: string }>(URL_)
    expect(result).toEqual({ ok: true, data: { hello: 'world' } })
  })

  it('returns an http error with status and statusText on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'nope' }, { status: 429, statusText: 'Too Many Requests' })
    )
    const result = await getJson(URL_)
    expect(result).toEqual({
      ok: false,
      error: { kind: 'http', status: 429, statusText: 'Too Many Requests' }
    })
  })

  it('returns a network error with the cause when fetch rejects with a TypeError', async () => {
    const cause = new TypeError('Failed to fetch')
    fetchMock.mockRejectedValue(cause)
    const result = await getJson(URL_)
    expect(result).toEqual({ ok: false, error: { kind: 'network', cause } })
  })

  it('returns aborted when fetch rejects with an AbortError', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
    const result = await getJson(URL_)
    expect(result).toEqual({ ok: false, error: { kind: 'aborted' } })
  })

  it('returns a parse error with the cause when the body is not valid JSON', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }))
    const result = await getJson(URL_)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('parse')
    expect(result.error).toHaveProperty('cause')
    expect(result.error).toEqual({ kind: 'parse', cause: expect.any(SyntaxError) })
  })

  it('passes the URL and the abort signal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const controller = new AbortController()
    await getJson(URL_, { signal: controller.signal })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(URL_, { signal: controller.signal })
  })

  it('never throws and never logs, whatever the failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
      .mockResolvedValueOnce(new Response('oops', { status: 500, statusText: 'Server Error' }))
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))

    for (let i = 0; i < 4; i++) {
      await expect(getJson(URL_)).resolves.toMatchObject({ ok: false })
    }
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
