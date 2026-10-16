import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  fetchGifsFromApi,
  type GifItem,
  type GifsError,
  type GifsResponse,
  type Result
} from '@/services'
import { useGifsStore } from '@/store'

vi.mock('@/services', () => ({ fetchGifsFromApi: vi.fn() }))

const fetchMock = vi.mocked(fetchGifsFromApi)

type GifsResult = Result<GifsResponse, GifsError>

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function gifs(...ids: string[]): GifItem[] {
  return ids.map((id) => ({ id, title: `Title ${id}`, url: `https://x/${id}.gif` }))
}

function page(ids: string[], next: string | null): GifsResponse {
  return { results: gifs(...ids), next }
}

function ok(data: GifsResponse): GifsResult {
  return { ok: true, data }
}

function fail(error: GifsError): GifsResult {
  return { ok: false, error }
}

const SIGNAL = { signal: expect.any(AbortSignal) }

/** Signal passed to the nth (0-based) fetchGifsFromApi call */
function signalOf(call: number): AbortSignal | undefined {
  return fetchMock.mock.calls[call]?.[1]?.signal
}

describe('useGifsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('first page', () => {
    it('calls the API with offset null and the given category/query', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], '12')))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'search', query: 'cats' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        { category: 'search', query: 'cats', offset: null },
        SIGNAL
      )
    })

    it('sets isLoading while pending and stores results, next and hasMore', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValue(d.promise)
      const store = useGifsStore()

      const pending = store.fetchGifs({ category: 'trends' })
      expect(store.isLoading).toBe(true)
      expect(store.isLoadingMore).toBe(false)

      d.resolve(ok(page(['a', 'b'], '12')))
      await pending

      expect(store.isLoading).toBe(false)
      expect(store.isLoadingMore).toBe(false)
      expect(store.gifs).toEqual(gifs('a', 'b'))
      expect(store.next).toBe('12')
      expect(store.hasMore).toBe(true)
      expect(store.error).toBeNull()
    })

    it('replaces existing gifs after a reset', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], null)))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], null)))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      store.$reset()
      await store.fetchGifs({ category: 'trends' })
      expect(store.gifs).toEqual(gifs('b'))
    })
  })

  describe('load more', () => {
    it('passes the previous next as offset, appends and toggles isLoadingMore', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'search', query: 'cats' })

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = store.fetchGifs({ category: 'search', query: 'cats' })

      expect(fetchMock).toHaveBeenLastCalledWith(
        {
          category: 'search',
          query: 'cats',
          offset: '2'
        },
        SIGNAL
      )
      expect(store.isLoadingMore).toBe(true)
      expect(store.isLoading).toBe(false)

      d.resolve(ok(page(['c'], '3')))
      await pending

      expect(store.isLoadingMore).toBe(false)
      expect(store.isLoading).toBe(false)
      expect(store.gifs).toEqual(gifs('a', 'b', 'c'))
      expect(store.next).toBe('3')
      expect(store.hasMore).toBe(true)
    })

    it('sets next null and hasMore false on the last page', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], null)))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      await store.fetchGifs({ category: 'trends' })

      expect(store.gifs).toEqual(gifs('a', 'b'))
      expect(store.next).toBeNull()
      expect(store.hasMore).toBe(false)
      expect(store.error).toBeNull()
    })

    it('does not set "No GIFs found." for an empty later page', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page([], null)))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      await store.fetchGifs({ category: 'trends' })

      expect(store.gifs).toEqual(gifs('a'))
      expect(store.error).toBeNull()
    })
  })

  describe('empty results and errors', () => {
    it('sets "No GIFs found." for an empty first page', async () => {
      fetchMock.mockResolvedValue(ok(page([], null)))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'search', query: 'zzz' })

      expect(store.gifs).toEqual([])
      expect(store.error).toBe('No GIFs found.')
      expect(store.hasMore).toBe(false)
      expect(store.isLoading).toBe(false)
    })

    it('sets "Failed to load GIFs." and next null when the API returns a network error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      await store.fetchGifs({ category: 'trends' })

      expect(store.error).toBe('Failed to load GIFs.')
      expect(store.next).toBeNull()
      expect(store.hasMore).toBe(false)
      expect(store.isLoading).toBe(false)
      expect(store.isLoadingMore).toBe(false)
    })

    it('sets "Failed to load GIFs." and next null when the API rejects', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      await store.fetchGifs({ category: 'trends' })

      expect(store.error).toBe('Failed to load GIFs.')
      expect(store.next).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.isLoadingMore).toBe(false)
    })

    it('clears a previous error when a new request starts', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      expect(store.error).toBe('Failed to load GIFs.')

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = store.fetchGifs({ category: 'trends' })
      expect(store.error).toBeNull()
      d.resolve(ok(page(['a'], null)))
      await pending
    })
  })

  describe('race guard', () => {
    it('ignores a stale first-page response that resolves after the newer one', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'search', query: 'cat' })
      const p2 = store.fetchGifs({ category: 'search', query: 'cats' })

      newer.resolve(ok(page(['new'], '1')))
      await p2
      older.resolve(ok(page(['old'], '99')))
      await p1

      expect(store.gifs).toEqual(gifs('new'))
      expect(store.next).toBe('1')
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
    })

    it('does not clear loading when a stale response lands while the newer one is pending', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'search', query: 'cat' })
      const p2 = store.fetchGifs({ category: 'search', query: 'cats' })

      older.resolve(ok(page(['old'], '99')))
      await p1

      expect(store.isLoading).toBe(true)
      expect(store.gifs).toEqual([])
      expect(store.next).toBeNull()

      newer.resolve(ok(page(['new'], null)))
      await p2

      expect(store.isLoading).toBe(false)
      expect(store.gifs).toEqual(gifs('new'))
    })

    it('ignores a stale rejection', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'trends' })
      const p2 = store.fetchGifs({ category: 'trends' })

      older.reject(new Error('aborted'))
      await p1
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(true)

      newer.resolve(ok(page(['new'], '1')))
      await p2
      expect(store.error).toBeNull()
      expect(store.gifs).toEqual(gifs('new'))
      expect(store.next).toBe('1')
    })

    it('ignores a response from before $reset that resolves after the newer one', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'trends' })
      store.$reset()
      const p2 = store.fetchGifs({ category: 'search', query: 'dogs' })

      newer.resolve(ok(page(['new'], '1')))
      await p2
      older.resolve(ok(page(['old'], '99')))
      await p1

      expect(store.gifs).toEqual(gifs('new'))
      expect(store.next).toBe('1')
    })

    it('ignores a response from before $reset while the newer one is pending', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'trends' })
      store.$reset()
      const p2 = store.fetchGifs({ category: 'search', query: 'dogs' })

      older.resolve(ok(page(['old'], '99')))
      await p1

      expect(store.isLoading).toBe(true)
      expect(store.gifs).toEqual([])
      expect(store.next).toBeNull()

      newer.resolve(ok(page(['new'], null)))
      await p2
      expect(store.gifs).toEqual(gifs('new'))
      expect(store.isLoading).toBe(false)
    })

    it('ignores a response from before $reset when no new request follows', async () => {
      const older = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'trends' })
      store.$reset()
      older.resolve(ok(page(['old'], '99')))
      await p1

      expect(store.gifs).toEqual([])
      expect(store.next).toBeNull()
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('typed results and logging', () => {
    it('sets no error and keeps gifs when the result is aborted', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(fail({ kind: 'aborted' }))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      await store.fetchGifs({ category: 'trends' })

      expect(store.error).toBeNull()
      expect(store.gifs).toEqual(gifs('a'))
      expect(store.next).toBe('1')
    })

    it('does not log an aborted result', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'aborted' }))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })

      expect(errorSpy).not.toHaveBeenCalled()
    })

    it.each<[string, GifsError]>([
      ['http', { kind: 'http', status: 500, statusText: 'Server Error' }],
      ['config', { kind: 'config' }],
      ['invalid', { kind: 'invalid' }],
      ['parse', { kind: 'parse', cause: new SyntaxError('bad json') }]
    ])('sets "Failed to load GIFs." for a %s error', async (_label, error) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail(error))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })

      expect(store.error).toBe('Failed to load GIFs.')
      expect(store.next).toBeNull()
      expect(store.isLoading).toBe(false)
    })

    it('logs a non-aborted failure with console.error exactly once', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(
        fail({ kind: 'http', status: 500, statusText: 'Server Error' })
      )
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })

      expect(errorSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('abort', () => {
    it('passes a fresh, non-aborted signal to each call', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], null)))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      await store.fetchGifs({ category: 'trends' })

      const first = signalOf(0)
      const second = signalOf(1)
      expect(first).toBeInstanceOf(AbortSignal)
      expect(second).toBeInstanceOf(AbortSignal)
      expect(second).not.toBe(first)
      expect(second?.aborted).toBe(false)
    })

    it('aborts the previous call when a new fetchGifs starts', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'search', query: 'cat' })
      expect(signalOf(0)?.aborted).toBe(false)

      const p2 = store.fetchGifs({ category: 'search', query: 'cats' })
      expect(signalOf(0)?.aborted).toBe(true)
      expect(signalOf(1)?.aborted).toBe(false)

      older.resolve(fail({ kind: 'aborted' }))
      newer.resolve(ok(page(['new'], null)))
      await Promise.all([p1, p2])
      expect(store.gifs).toEqual(gifs('new'))
      expect(store.error).toBeNull()
    })

    it('$reset aborts the in-flight signal', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const store = useGifsStore()

      const pending = store.fetchGifs({ category: 'trends' })
      store.$reset()
      expect(signalOf(0)?.aborted).toBe(true)

      d.resolve(fail({ kind: 'aborted' }))
      await pending
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('cancel', () => {
    it('aborts the signal, clears loading flags and keeps gifs, next and error', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = store.fetchGifs({ category: 'trends' })
      expect(store.isLoadingMore).toBe(true)

      store.cancel()

      expect(signalOf(1)?.aborted).toBe(true)
      expect(store.isLoading).toBe(false)
      expect(store.isLoadingMore).toBe(false)
      expect(store.gifs).toEqual(gifs('a'))
      expect(store.next).toBe('1')
      expect(store.error).toBeNull()

      d.resolve(fail({ kind: 'aborted' }))
      await pending
    })

    it('keeps an existing error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })

      store.cancel()
      expect(store.error).toBe('Failed to load GIFs.')
    })

    it('ignores a late successful response after cancel', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const store = useGifsStore()

      const pending = store.fetchGifs({ category: 'trends' })
      store.cancel()
      d.resolve(ok(page(['late'], '99')))
      await pending

      expect(store.gifs).toEqual([])
      expect(store.next).toBeNull()
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.isLoadingMore).toBe(false)
    })

    it('ignores a late failure after cancel', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const store = useGifsStore()

      const pending = store.fetchGifs({ category: 'trends' })
      store.cancel()
      d.resolve(fail({ kind: 'http', status: 500, statusText: 'Server Error' }))
      await pending

      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('is a no-op when nothing is in flight', () => {
      const store = useGifsStore()
      expect(() => store.cancel()).not.toThrow()
      expect(store.isLoading).toBe(false)
      expect(store.gifs).toEqual([])
    })
  })

  describe('$reset', () => {
    it('clears all state', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      await store.fetchGifs({ category: 'trends' })
      expect(store.gifs.length).toBe(1)
      expect(store.error).not.toBeNull()

      store.$reset()

      expect(store.gifs).toEqual([])
      expect(store.next).toBeNull()
      expect(store.hasMore).toBe(false)
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.isLoadingMore).toBe(false)
    })

    it('makes the following fetch a first page again', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], null)))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      store.$reset()
      await store.fetchGifs({ category: 'trends' })

      expect(fetchMock).toHaveBeenLastCalledWith(
        {
          category: 'trends',
          query: undefined,
          offset: null
        },
        SIGNAL
      )
      expect(store.gifs).toEqual(gifs('b'))
    })
  })
})
