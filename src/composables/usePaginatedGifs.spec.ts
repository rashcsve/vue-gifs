import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { fetchGifsFromApi, type Category, type GifsError } from '@/services'
import { usePaginatedGifs } from '@/composables/usePaginatedGifs'
import { deferred, fail, gifs, ok, page, type GifsResult } from '@/test/helpers'

vi.mock('@/services', () => ({ fetchGifsFromApi: vi.fn() }))

const fetchMock = vi.mocked(fetchGifsFromApi)

const SIGNAL = { signal: expect.any(AbortSignal) }

/** Signal passed to the nth (0-based) fetchGifsFromApi call */
function signalOf(call: number): AbortSignal | undefined {
  return fetchMock.mock.calls[call]?.[1]?.signal
}

/** Every composable runs inside its own effect scope, stopped after each test */
const scopes: EffectScope[] = []

function setup(category: Category = 'trends') {
  const scope = effectScope()
  scopes.push(scope)
  const api = scope.run(() => usePaginatedGifs(category))
  if (!api) throw new Error('usePaginatedGifs returned nothing')
  return { ...api, scope }
}

describe('usePaginatedGifs', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterEach(() => {
    scopes.splice(0).forEach((s) => s.stop())
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('starts empty, idle and without error', () => {
      const s = setup()
      expect(s.gifs.value).toEqual([])
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
      expect(s.hasMore.value).toBe(false)
      expect(s.error.value).toBeNull()
      expect(s.isEmpty.value).toBe(false)
      expect(s.query.value).toBe('')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('first page', () => {
    it('calls the API with offset null and its category and the given query', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], '12')))
      const s = setup('search')
      await s.load('cats')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        { category: 'search', query: 'cats', offset: null },
        SIGNAL
      )
    })

    it('passes query undefined when load() is called without one', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const s = setup('trends')
      await s.load()
      expect(fetchMock).toHaveBeenCalledWith(
        { category: 'trends', query: undefined, offset: null },
        SIGNAL
      )
    })

    it('exposes the query fetched by the last load()', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const s = setup('search')
      await s.load('cats')
      expect(s.query.value).toBe('cats')
      await s.load()
      expect(s.query.value).toBe('')
    })

    it('sets isLoading while pending and stores results and hasMore', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValue(d.promise)
      const s = setup()

      const pending = s.load()
      expect(s.isLoading.value).toBe(true)
      expect(s.isLoadingMore.value).toBe(false)

      d.resolve(ok(page(['a', 'b'], '12')))
      await pending

      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
      expect(s.gifs.value).toEqual(gifs('a', 'b'))
      expect(s.hasMore.value).toBe(true)
      expect(s.error.value).toBeNull()
      expect(s.isEmpty.value).toBe(false)
    })

    it('replaces existing gifs on a new load()', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], null)))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], null)))
      const s = setup()
      await s.load()
      await s.load()
      expect(s.gifs.value).toEqual(gifs('b'))
    })
  })

  describe('load more', () => {
    it('passes the previous next as offset with the same query, appends and toggles isLoadingMore', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
      const s = setup('search')
      await s.load('cats')

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = s.loadMore()

      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'search', query: 'cats', offset: '2' },
        SIGNAL
      )
      expect(s.isLoadingMore.value).toBe(true)
      expect(s.isLoading.value).toBe(false)

      d.resolve(ok(page(['c'], '3')))
      await pending

      expect(s.isLoadingMore.value).toBe(false)
      expect(s.isLoading.value).toBe(false)
      expect(s.gifs.value).toEqual(gifs('a', 'b', 'c'))
      expect(s.hasMore.value).toBe(true)
    })

    it('uses the newest next for each following page', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], '2')))
      fetchMock.mockResolvedValueOnce(ok(page(['c'], null)))
      const s = setup()
      await s.load()
      await s.loadMore()
      await s.loadMore()

      expect(fetchMock.mock.calls.map(([args]) => args.offset)).toEqual([null, '1', '2'])
      expect(s.gifs.value).toEqual(gifs('a', 'b', 'c'))
    })

    it('sets hasMore false on the last page', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], null)))
      const s = setup()
      await s.load()
      await s.loadMore()

      expect(s.gifs.value).toEqual(gifs('a', 'b'))
      expect(s.hasMore.value).toBe(false)
      expect(s.error.value).toBeNull()
    })

    it('keeps isEmpty false and error null for an empty later page', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page([], null)))
      const s = setup()
      await s.load()
      await s.loadMore()

      expect(s.gifs.value).toEqual(gifs('a'))
      expect(s.isEmpty.value).toBe(false)
      expect(s.error.value).toBeNull()
    })

    it('is a no-op before any page has loaded', async () => {
      const s = setup()
      await s.loadMore()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(s.isLoadingMore.value).toBe(false)
    })

    it('is a no-op when hasMore is false', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], null)))
      const s = setup()
      await s.load()
      await s.loadMore()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(s.isLoadingMore.value).toBe(false)
      expect(s.gifs.value).toEqual(gifs('a'))
    })

    it('is a no-op while the first page is loading', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const s = setup()

      const pending = s.load()
      await s.loadMore()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(s.isLoadingMore.value).toBe(false)

      d.resolve(ok(page(['a'], '1')))
      await pending
    })

    it('is a no-op while another page is loading', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      const s = setup()
      await s.load()

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = s.loadMore()
      await s.loadMore()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(signalOf(1)?.aborted).toBe(false)

      d.resolve(ok(page(['b'], null)))
      await pending
      expect(s.gifs.value).toEqual(gifs('a', 'b'))
    })
  })

  describe('empty results', () => {
    it('sets isEmpty (not error) for an empty first page', async () => {
      fetchMock.mockResolvedValue(ok(page([], null)))
      const s = setup('search')
      await s.load('zzz')

      expect(s.gifs.value).toEqual([])
      expect(s.isEmpty.value).toBe(true)
      expect(s.error.value).toBeNull()
      expect(s.hasMore.value).toBe(false)
      expect(s.isLoading.value).toBe(false)
      expect(s.query.value).toBe('zzz')
    })

    it('does not set isEmpty while the first page is pending', () => {
      fetchMock.mockReturnValue(deferred<GifsResult>().promise)
      const s = setup()
      void s.load()
      expect(s.isEmpty.value).toBe(false)
    })

    it('clears isEmpty when a new load() starts', async () => {
      fetchMock.mockResolvedValueOnce(ok(page([], null)))
      const s = setup('search')
      await s.load('zzz')
      expect(s.isEmpty.value).toBe(true)

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = s.load('cats')
      expect(s.isEmpty.value).toBe(false)

      d.resolve(ok(page(['a'], null)))
      await pending
      expect(s.isEmpty.value).toBe(false)
      expect(s.gifs.value).toEqual(gifs('a'))
    })
  })

  describe('errors', () => {
    it('sets "Failed to load GIFs." on a failed first page, with empty gifs and no isEmpty', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const s = setup()
      await s.load()

      expect(s.error.value).toBe('Failed to load GIFs.')
      expect(s.gifs.value).toEqual([])
      expect(s.isEmpty.value).toBe(false)
      expect(s.hasMore.value).toBe(false)
      expect(s.isLoading.value).toBe(false)
    })

    it('sets "Failed to load GIFs." on a rejected first page', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const s = setup()
      await s.load()

      expect(s.error.value).toBe('Failed to load GIFs.')
      expect(s.gifs.value).toEqual([])
      expect(s.isLoading.value).toBe(false)
    })

    it('keeps gifs and hasMore when a load-more returns a network error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const s = setup()
      await s.load()
      await s.loadMore()

      expect(s.error.value).toBe('Failed to load GIFs.')
      expect(s.gifs.value).toEqual(gifs('a'))
      expect(s.hasMore.value).toBe(true)
      expect(s.isEmpty.value).toBe(false)
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
    })

    it('keeps gifs and hasMore when a load-more rejects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const s = setup()
      await s.load()
      await s.loadMore()

      expect(s.error.value).toBe('Failed to load GIFs.')
      expect(s.gifs.value).toEqual(gifs('a'))
      expect(s.hasMore.value).toBe(true)
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
    })

    it('clears a previous error when a new load() starts', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const s = setup()
      await s.load()
      expect(s.error.value).toBe('Failed to load GIFs.')

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = s.load()
      expect(s.error.value).toBeNull()
      d.resolve(ok(page(['a'], null)))
      await pending
      expect(s.error.value).toBeNull()
    })
  })

  describe('retry', () => {
    it('repeats a failed first page with offset null and the same query', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      const s = setup('search')
      await s.load('cats')
      await s.retry()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'search', query: 'cats', offset: null },
        SIGNAL
      )
      expect(s.gifs.value).toEqual(gifs('a'))
      expect(s.hasMore.value).toBe(true)
      expect(s.error.value).toBeNull()
      expect(s.query.value).toBe('cats')
    })

    it('repeats a failed load-more with the previous offset and appends', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const s = setup('search')
      await s.load('cats')
      await s.loadMore()

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = s.retry()

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'search', query: 'cats', offset: '2' },
        SIGNAL
      )
      expect(s.isLoadingMore.value).toBe(true)
      expect(s.isLoading.value).toBe(false)
      expect(s.error.value).toBeNull()
      expect(s.gifs.value).toEqual(gifs('a', 'b'))

      d.resolve(ok(page(['c'], null)))
      await pending

      expect(s.gifs.value).toEqual(gifs('a', 'b', 'c'))
      expect(s.hasMore.value).toBe(false)
      expect(s.error.value).toBeNull()
    })

    it('repeats a rejected load-more with the previous offset and appends', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockRejectedValueOnce(new Error('network'))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], '2')))
      const s = setup()
      await s.load()
      await s.loadMore()
      await s.retry()

      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'trends', query: undefined, offset: '1' },
        SIGNAL
      )
      expect(s.gifs.value).toEqual(gifs('a', 'b'))
      expect(s.hasMore.value).toBe(true)
      expect(s.error.value).toBeNull()
    })

    it('is a no-op on a fresh instance', async () => {
      const s = setup()
      await s.retry()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
      expect(s.gifs.value).toEqual([])
    })

    it('is a no-op after a successful load()', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      const s = setup('search')
      await s.load('cats')
      await s.retry()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
      expect(s.gifs.value).toEqual(gifs('a'))
      expect(s.hasMore.value).toBe(true)
    })

    it('is a no-op after a successful loadMore()', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], '2')))
      const s = setup('search')
      await s.load('cats')
      await s.loadMore()
      await s.retry()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
      expect(s.gifs.value).toEqual(gifs('a', 'b'))
      expect(s.hasMore.value).toBe(true)
    })

    it('is a no-op after a failed load-more was followed by a successful retry', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockRejectedValueOnce(new Error('network'))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], '2')))
      const s = setup()
      await s.load()
      await s.loadMore()
      await s.retry()
      await s.retry()

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(s.gifs.value).toEqual(gifs('a', 'b'))
    })
  })

  describe('race guard', () => {
    it('ignores a stale first-page response that resolves after the newer one', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const s = setup('search')

      const p1 = s.load('cat')
      const p2 = s.load('cats')

      newer.resolve(ok(page(['new'], '1')))
      await p2
      older.resolve(ok(page(['old'], '99')))
      await p1

      expect(s.gifs.value).toEqual(gifs('new'))
      expect(s.hasMore.value).toBe(true)
      expect(s.error.value).toBeNull()
      expect(s.isLoading.value).toBe(false)
      expect(s.query.value).toBe('cats')
    })

    it('does not clear loading when a stale response lands while the newer one is pending', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const s = setup('search')

      const p1 = s.load('cat')
      const p2 = s.load('cats')

      older.resolve(ok(page(['old'], '99')))
      await p1

      expect(s.isLoading.value).toBe(true)
      expect(s.gifs.value).toEqual([])
      expect(s.hasMore.value).toBe(false)

      newer.resolve(ok(page(['new'], null)))
      await p2

      expect(s.isLoading.value).toBe(false)
      expect(s.gifs.value).toEqual(gifs('new'))
    })

    it('ignores a stale rejection', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const s = setup()

      const p1 = s.load()
      const p2 = s.load()

      older.reject(new Error('aborted'))
      await p1
      expect(s.error.value).toBeNull()
      expect(s.isLoading.value).toBe(true)

      newer.resolve(ok(page(['new'], '1')))
      await p2
      expect(s.error.value).toBeNull()
      expect(s.gifs.value).toEqual(gifs('new'))
      expect(s.hasMore.value).toBe(true)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('ignores a stale empty first page (no isEmpty from an old query)', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const s = setup('search')

      const p1 = s.load('zzz')
      const p2 = s.load('cats')

      newer.resolve(ok(page(['new'], null)))
      await p2
      older.resolve(ok(page([], null)))
      await p1

      expect(s.isEmpty.value).toBe(false)
      expect(s.gifs.value).toEqual(gifs('new'))
    })

    it('ignores a pending load-more response once a new load() starts', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      const s = setup('search')
      await s.load('cat')

      const more = deferred<GifsResult>()
      const fresh = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(more.promise).mockReturnValueOnce(fresh.promise)

      const p1 = s.loadMore()
      const p2 = s.load('dogs')
      expect(signalOf(1)?.aborted).toBe(true)
      expect(s.gifs.value).toEqual([])
      expect(s.isLoading.value).toBe(true)
      expect(s.isLoadingMore.value).toBe(false)

      more.resolve(ok(page(['stale'], '2')))
      await p1
      expect(s.gifs.value).toEqual([])
      expect(s.isLoading.value).toBe(true)

      fresh.resolve(ok(page(['new'], null)))
      await p2
      expect(s.gifs.value).toEqual(gifs('new'))
      expect(s.hasMore.value).toBe(false)
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
    })
  })

  describe('typed results and logging', () => {
    it('sets no error and keeps gifs when a load-more result is aborted', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(fail({ kind: 'aborted' }))
      const s = setup()
      await s.load()
      await s.loadMore()

      expect(s.error.value).toBeNull()
      expect(s.gifs.value).toEqual(gifs('a'))
      expect(s.hasMore.value).toBe(true)
    })

    it('does not log or set isEmpty for an aborted result', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'aborted' }))
      const s = setup()
      await s.load()

      expect(errorSpy).not.toHaveBeenCalled()
      expect(s.error.value).toBeNull()
      expect(s.isEmpty.value).toBe(false)
    })

    it.each<[string, GifsError]>([
      ['http', { kind: 'http', status: 500, statusText: 'Server Error' }],
      ['config', { kind: 'config' }],
      ['invalid', { kind: 'invalid' }],
      ['parse', { kind: 'parse', cause: new SyntaxError('bad json') }]
    ])('sets "Failed to load GIFs." for a %s error', async (_label, error) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail(error))
      const s = setup()
      await s.load()

      expect(s.error.value).toBe('Failed to load GIFs.')
      expect(s.hasMore.value).toBe(false)
      expect(s.isEmpty.value).toBe(false)
      expect(s.isLoading.value).toBe(false)
    })

    it('logs a non-aborted failure with console.error exactly once', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(
        fail({ kind: 'http', status: 500, statusText: 'Server Error' })
      )
      const s = setup()
      await s.load()

      expect(errorSpy).toHaveBeenCalledTimes(1)
    })

    it('logs a rejection with console.error exactly once', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const s = setup()
      await s.load()

      expect(errorSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('abort', () => {
    it('passes a fresh, non-aborted signal to each call', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], null)))
      const s = setup()
      await s.load()
      await s.loadMore()

      const first = signalOf(0)
      const second = signalOf(1)
      expect(first).toBeInstanceOf(AbortSignal)
      expect(second).toBeInstanceOf(AbortSignal)
      expect(second).not.toBe(first)
      expect(second?.aborted).toBe(false)
    })

    it('aborts the previous call when a new load() starts and the new results win', async () => {
      const older = deferred<GifsResult>()
      const newer = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const s = setup('search')

      const p1 = s.load('cat')
      expect(signalOf(0)?.aborted).toBe(false)

      const p2 = s.load('cats')
      expect(signalOf(0)?.aborted).toBe(true)
      expect(signalOf(1)?.aborted).toBe(false)

      older.resolve(fail({ kind: 'aborted' }))
      newer.resolve(ok(page(['new'], null)))
      await Promise.all([p1, p2])
      expect(s.gifs.value).toEqual(gifs('new'))
      expect(s.error.value).toBeNull()
      expect(s.isLoading.value).toBe(false)
    })

    it('load() resets state synchronously while the new first page is pending', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const s = setup()
      await s.load()
      await s.loadMore()
      expect(s.gifs.value).toEqual(gifs('a'))
      expect(s.error.value).not.toBeNull()

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = s.load()

      expect(s.gifs.value).toEqual([])
      expect(s.hasMore.value).toBe(false)
      expect(s.error.value).toBeNull()
      expect(s.isEmpty.value).toBe(false)
      expect(s.isLoading.value).toBe(true)
      expect(s.isLoadingMore.value).toBe(false)
      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'trends', query: undefined, offset: null },
        SIGNAL
      )

      d.resolve(ok(page(['b'], null)))
      await pending
      expect(s.gifs.value).toEqual(gifs('b'))
    })
  })

  describe('cancel', () => {
    it('aborts the signal, clears loading flags and keeps gifs, hasMore and error', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      const s = setup()
      await s.load()

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = s.loadMore()
      expect(s.isLoadingMore.value).toBe(true)

      s.cancel()

      expect(signalOf(1)?.aborted).toBe(true)
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
      expect(s.gifs.value).toEqual(gifs('a'))
      expect(s.hasMore.value).toBe(true)
      expect(s.error.value).toBeNull()

      d.resolve(fail({ kind: 'aborted' }))
      await pending
    })

    it('keeps the next offset, so a later loadMore() resumes from it', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      const s = setup()
      await s.load()

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = s.loadMore()
      s.cancel()
      d.resolve(fail({ kind: 'aborted' }))
      await pending

      fetchMock.mockResolvedValueOnce(ok(page(['b'], null)))
      await s.loadMore()
      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'trends', query: undefined, offset: '1' },
        SIGNAL
      )
      expect(s.gifs.value).toEqual(gifs('a', 'b'))
    })

    it('keeps an existing error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const s = setup()
      await s.load()

      s.cancel()
      expect(s.error.value).toBe('Failed to load GIFs.')
    })

    it('ignores a late successful response after cancel', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const s = setup()

      const pending = s.load()
      s.cancel()
      d.resolve(ok(page(['late'], '99')))
      await pending

      expect(s.gifs.value).toEqual([])
      expect(s.hasMore.value).toBe(false)
      expect(s.error.value).toBeNull()
      expect(s.isEmpty.value).toBe(false)
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
    })

    it('ignores a late failure after cancel', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const s = setup()

      const pending = s.load()
      s.cancel()
      d.resolve(fail({ kind: 'http', status: 500, statusText: 'Server Error' }))
      await pending

      expect(s.error.value).toBeNull()
      expect(s.isLoading.value).toBe(false)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('is a no-op when nothing is in flight', () => {
      const s = setup()
      expect(() => s.cancel()).not.toThrow()
      expect(s.isLoading.value).toBe(false)
      expect(s.gifs.value).toEqual([])
    })
  })

  describe('reset', () => {
    function expectCleared(s: ReturnType<typeof setup>) {
      expect(s.gifs.value).toEqual([])
      expect(s.hasMore.value).toBe(false)
      expect(s.error.value).toBeNull()
      expect(s.isEmpty.value).toBe(false)
      expect(s.query.value).toBe('')
      expect(s.isLoading.value).toBe(false)
      expect(s.isLoadingMore.value).toBe(false)
    }

    it('aborts an in-flight first page and clears isLoading', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const s = setup('search')

      const pending = s.load('cats')
      expect(s.isLoading.value).toBe(true)

      s.reset()

      expect(signalOf(0)?.aborted).toBe(true)
      expectCleared(s)

      d.resolve(fail({ kind: 'aborted' }))
      await pending
    })

    it('aborts an in-flight load-more and clears gifs, hasMore, query and isLoadingMore', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
      const s = setup('search')
      await s.load('cats')

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = s.loadMore()
      expect(s.isLoadingMore.value).toBe(true)

      s.reset()

      expect(signalOf(1)?.aborted).toBe(true)
      expectCleared(s)

      d.resolve(fail({ kind: 'aborted' }))
      await pending
    })

    it('clears an error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const s = setup('search')
      await s.load('cats')
      expect(s.error.value).toBe('Failed to load GIFs.')

      s.reset()

      expectCleared(s)
    })

    it('clears isEmpty', async () => {
      fetchMock.mockResolvedValueOnce(ok(page([], null)))
      const s = setup('search')
      await s.load('zzz')
      expect(s.isEmpty.value).toBe(true)

      s.reset()

      expectCleared(s)
    })

    it('ignores a late successful response after reset', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const s = setup('search')

      const pending = s.load('cats')
      s.reset()
      d.resolve(ok(page(['late'], '99')))
      await pending

      expectCleared(s)
    })

    it('ignores a late empty response after reset (no isEmpty)', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const s = setup('search')

      const pending = s.load('zzz')
      s.reset()
      d.resolve(ok(page([], null)))
      await pending

      expectCleared(s)
    })

    it('ignores a late failure after reset and does not log', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const s = setup('search')

      const pending = s.load('cats')
      s.reset()
      d.resolve(fail({ kind: 'http', status: 500, statusText: 'Server Error' }))
      await pending

      expectCleared(s)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('ignores a late rejection after reset and does not log', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const s = setup('search')

      const pending = s.load('cats')
      s.reset()
      d.reject(new Error('network'))
      await pending

      expectCleared(s)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('makes loadMore() a no-op afterwards', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      const s = setup('search')
      await s.load('cats')

      s.reset()
      await s.loadMore()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expectCleared(s)
    })

    it('makes retry() a no-op after a failed first page', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const s = setup('search')
      await s.load('cats')

      s.reset()
      await s.retry()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expectCleared(s)
    })

    it('makes retry() a no-op after a failed load-more', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const s = setup('search')
      await s.load('cats')
      await s.loadMore()

      s.reset()
      await s.retry()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expectCleared(s)
    })

    it('is a no-op on a fresh instance', () => {
      const s = setup()
      expect(() => s.reset()).not.toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
      expectCleared(s)
    })

    it('allows a new load() afterwards', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], '1')))
      fetchMock.mockResolvedValueOnce(ok(page(['b'], null)))
      const s = setup('search')
      await s.load('cats')
      s.reset()
      await s.load('dogs')

      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'search', query: 'dogs', offset: null },
        SIGNAL
      )
      expect(s.gifs.value).toEqual(gifs('b'))
      expect(s.query.value).toBe('dogs')
    })
  })

  describe('isolation', () => {
    it('keeps independent state per instance', async () => {
      fetchMock.mockImplementation(async ({ category }) =>
        category === 'trends' ? ok(page(['t1', 't2'], '2')) : ok(page([], null))
      )
      const trends = setup('trends')
      const search = setup('search')

      await trends.load()
      await search.load('zzz')

      expect(trends.gifs.value).toEqual(gifs('t1', 't2'))
      expect(trends.hasMore.value).toBe(true)
      expect(trends.isEmpty.value).toBe(false)
      expect(trends.query.value).toBe('')

      expect(search.gifs.value).toEqual([])
      expect(search.hasMore.value).toBe(false)
      expect(search.isEmpty.value).toBe(true)
      expect(search.query.value).toBe('zzz')
    })

    it('does not abort or reset another instance', async () => {
      const t = deferred<GifsResult>()
      const q = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(t.promise).mockReturnValueOnce(q.promise)
      const trends = setup('trends')
      const search = setup('search')

      const p1 = trends.load()
      const p2 = search.load('cats')
      expect(signalOf(0)?.aborted).toBe(false)
      expect(trends.isLoading.value).toBe(true)

      search.cancel()
      expect(signalOf(0)?.aborted).toBe(false)
      expect(signalOf(1)?.aborted).toBe(true)
      expect(trends.isLoading.value).toBe(true)

      t.resolve(ok(page(['t'], null)))
      q.resolve(fail({ kind: 'aborted' }))
      await Promise.all([p1, p2])

      expect(trends.gifs.value).toEqual(gifs('t'))
      expect(search.gifs.value).toEqual([])
    })
  })

  describe('scope dispose', () => {
    it('aborts the in-flight request when its effect scope stops', () => {
      fetchMock.mockReturnValueOnce(deferred<GifsResult>().promise)
      const s = setup()

      void s.load()
      expect(signalOf(0)?.aborted).toBe(false)

      s.scope.stop()
      expect(signalOf(0)?.aborted).toBe(true)
    })

    it('ignores a late response after its scope stops', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const s = setup()

      const pending = s.load()
      s.scope.stop()
      d.resolve(ok(page(['late'], '99')))
      await pending

      expect(s.gifs.value).toEqual([])
      expect(s.hasMore.value).toBe(false)
      expect(s.isEmpty.value).toBe(false)
      expect(s.isLoading.value).toBe(false)
      expect(s.error.value).toBeNull()
      expect(errorSpy).not.toHaveBeenCalled()
    })
  })
})
