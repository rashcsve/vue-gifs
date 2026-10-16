import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { fetchGifsFromApi, type GifItem, type GifsResponse } from '@/services'
import { useGifsStore } from '@/store'

vi.mock('@/services', () => ({ fetchGifsFromApi: vi.fn() }))

const fetchMock = vi.mocked(fetchGifsFromApi)

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

describe('useGifsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
  })

  describe('first page', () => {
    it('calls the API with offset null and the given category/query', async () => {
      fetchMock.mockResolvedValue(page(['a'], '12'))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'search', query: 'cats' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith({ category: 'search', query: 'cats', offset: null })
    })

    it('sets isLoading while pending and stores results, next and hasMore', async () => {
      const d = deferred<GifsResponse | null>()
      fetchMock.mockReturnValue(d.promise)
      const store = useGifsStore()

      const pending = store.fetchGifs({ category: 'trends' })
      expect(store.isLoading).toBe(true)
      expect(store.isLoadingMore).toBe(false)

      d.resolve(page(['a', 'b'], '12'))
      await pending

      expect(store.isLoading).toBe(false)
      expect(store.isLoadingMore).toBe(false)
      expect(store.gifs).toEqual(gifs('a', 'b'))
      expect(store.next).toBe('12')
      expect(store.hasMore).toBe(true)
      expect(store.error).toBeNull()
    })

    it('replaces existing gifs after a reset', async () => {
      fetchMock.mockResolvedValueOnce(page(['a'], null))
      fetchMock.mockResolvedValueOnce(page(['b'], null))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      store.$reset()
      await store.fetchGifs({ category: 'trends' })
      expect(store.gifs).toEqual(gifs('b'))
    })
  })

  describe('load more', () => {
    it('passes the previous next as offset, appends and toggles isLoadingMore', async () => {
      fetchMock.mockResolvedValueOnce(page(['a', 'b'], '2'))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'search', query: 'cats' })

      const d = deferred<GifsResponse | null>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = store.fetchGifs({ category: 'search', query: 'cats' })

      expect(fetchMock).toHaveBeenLastCalledWith({
        category: 'search',
        query: 'cats',
        offset: '2'
      })
      expect(store.isLoadingMore).toBe(true)
      expect(store.isLoading).toBe(false)

      d.resolve(page(['c'], '3'))
      await pending

      expect(store.isLoadingMore).toBe(false)
      expect(store.isLoading).toBe(false)
      expect(store.gifs).toEqual(gifs('a', 'b', 'c'))
      expect(store.next).toBe('3')
      expect(store.hasMore).toBe(true)
    })

    it('sets next null and hasMore false on the last page', async () => {
      fetchMock.mockResolvedValueOnce(page(['a'], '1'))
      fetchMock.mockResolvedValueOnce(page(['b'], null))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      await store.fetchGifs({ category: 'trends' })

      expect(store.gifs).toEqual(gifs('a', 'b'))
      expect(store.next).toBeNull()
      expect(store.hasMore).toBe(false)
      expect(store.error).toBeNull()
    })

    it('does not set "No GIFs found." for an empty later page', async () => {
      fetchMock.mockResolvedValueOnce(page(['a'], '1'))
      fetchMock.mockResolvedValueOnce(page([], null))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      await store.fetchGifs({ category: 'trends' })

      expect(store.gifs).toEqual(gifs('a'))
      expect(store.error).toBeNull()
    })
  })

  describe('empty results and errors', () => {
    it('sets "No GIFs found." for an empty first page', async () => {
      fetchMock.mockResolvedValue(page([], null))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'search', query: 'zzz' })

      expect(store.gifs).toEqual([])
      expect(store.error).toBe('No GIFs found.')
      expect(store.hasMore).toBe(false)
      expect(store.isLoading).toBe(false)
    })

    it('sets "Failed to load GIFs." and next null when the API returns null', async () => {
      fetchMock.mockResolvedValueOnce(page(['a'], '1'))
      fetchMock.mockResolvedValueOnce(null)
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
      fetchMock.mockResolvedValueOnce(page(['a'], '1'))
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

      const d = deferred<GifsResponse | null>()
      fetchMock.mockReturnValueOnce(d.promise)
      const pending = store.fetchGifs({ category: 'trends' })
      expect(store.error).toBeNull()
      d.resolve(page(['a'], null))
      await pending
    })
  })

  describe('race guard', () => {
    it('ignores a stale first-page response that resolves after the newer one', async () => {
      const older = deferred<GifsResponse | null>()
      const newer = deferred<GifsResponse | null>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'search', query: 'cat' })
      const p2 = store.fetchGifs({ category: 'search', query: 'cats' })

      newer.resolve(page(['new'], '1'))
      await p2
      older.resolve(page(['old'], '99'))
      await p1

      expect(store.gifs).toEqual(gifs('new'))
      expect(store.next).toBe('1')
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
    })

    it('does not clear loading when a stale response lands while the newer one is pending', async () => {
      const older = deferred<GifsResponse | null>()
      const newer = deferred<GifsResponse | null>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'search', query: 'cat' })
      const p2 = store.fetchGifs({ category: 'search', query: 'cats' })

      older.resolve(page(['old'], '99'))
      await p1

      expect(store.isLoading).toBe(true)
      expect(store.gifs).toEqual([])
      expect(store.next).toBeNull()

      newer.resolve(page(['new'], null))
      await p2

      expect(store.isLoading).toBe(false)
      expect(store.gifs).toEqual(gifs('new'))
    })

    it('ignores a stale rejection', async () => {
      const older = deferred<GifsResponse | null>()
      const newer = deferred<GifsResponse | null>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'trends' })
      const p2 = store.fetchGifs({ category: 'trends' })

      older.reject(new Error('aborted'))
      await p1
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(true)

      newer.resolve(page(['new'], '1'))
      await p2
      expect(store.error).toBeNull()
      expect(store.gifs).toEqual(gifs('new'))
      expect(store.next).toBe('1')
    })

    it('ignores a response from before $reset that resolves after the newer one', async () => {
      const older = deferred<GifsResponse | null>()
      const newer = deferred<GifsResponse | null>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'trends' })
      store.$reset()
      const p2 = store.fetchGifs({ category: 'search', query: 'dogs' })

      newer.resolve(page(['new'], '1'))
      await p2
      older.resolve(page(['old'], '99'))
      await p1

      expect(store.gifs).toEqual(gifs('new'))
      expect(store.next).toBe('1')
    })

    it('ignores a response from before $reset while the newer one is pending', async () => {
      const older = deferred<GifsResponse | null>()
      const newer = deferred<GifsResponse | null>()
      fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'trends' })
      store.$reset()
      const p2 = store.fetchGifs({ category: 'search', query: 'dogs' })

      older.resolve(page(['old'], '99'))
      await p1

      expect(store.isLoading).toBe(true)
      expect(store.gifs).toEqual([])
      expect(store.next).toBeNull()

      newer.resolve(page(['new'], null))
      await p2
      expect(store.gifs).toEqual(gifs('new'))
      expect(store.isLoading).toBe(false)
    })

    it('ignores a response from before $reset when no new request follows', async () => {
      const older = deferred<GifsResponse | null>()
      fetchMock.mockReturnValueOnce(older.promise)
      const store = useGifsStore()

      const p1 = store.fetchGifs({ category: 'trends' })
      store.$reset()
      older.resolve(page(['old'], '99'))
      await p1

      expect(store.gifs).toEqual([])
      expect(store.next).toBeNull()
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('$reset', () => {
    it('clears all state', async () => {
      fetchMock.mockResolvedValueOnce(page(['a'], '1'))
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
      fetchMock.mockResolvedValueOnce(page(['a'], '1'))
      fetchMock.mockResolvedValueOnce(page(['b'], null))
      const store = useGifsStore()
      await store.fetchGifs({ category: 'trends' })
      store.$reset()
      await store.fetchGifs({ category: 'trends' })

      expect(fetchMock).toHaveBeenLastCalledWith({
        category: 'trends',
        query: undefined,
        offset: null
      })
      expect(store.gifs).toEqual(gifs('b'))
    })
  })
})
