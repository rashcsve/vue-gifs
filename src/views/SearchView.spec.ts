import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SearchView from '@/views/SearchView.vue'
import { fetchGifsFromApi } from '@/services'
import { deferred, fail, FakeObserver, ok, page, type GifsResult } from '@/test/helpers'

vi.mock('@/services', () => ({ fetchGifsFromApi: vi.fn() }))

const fetchMock = vi.mocked(fetchGifsFromApi)

const SIGNAL = { signal: expect.any(AbortSignal) }
const NETWORK_ERROR = fail({ kind: 'network', cause: new TypeError('offline') })

/** Signal passed to the nth (0-based) fetchGifsFromApi call */
function signalOf(call: number): AbortSignal | undefined {
  return fetchMock.mock.calls[call]?.[1]?.signal
}

function firstPage(query: string) {
  return { category: 'search', query, offset: null }
}

const wrappers: VueWrapper[] = []

function mountView(): VueWrapper {
  const wrapper = mount(SearchView)
  wrappers.push(wrapper)
  return wrapper
}

function input(wrapper: VueWrapper) {
  return wrapper.get('input[aria-label="Search GIFs"]')
}

/** Type into the search box (fires the input event that starts the debounce) */
async function type(wrapper: VueWrapper, value: string) {
  await input(wrapper).setValue(value)
}

async function press(wrapper: VueWrapper, key: 'Enter' | 'Escape') {
  await input(wrapper).trigger('keydown', { key })
  await flushPromises()
}

async function wait(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  await flushPromises()
}

function titles(wrapper: VueWrapper): (string | undefined)[] {
  return wrapper.findAll('[title^="Title "]').map((el) => el.attributes('title'))
}

/** Visible (non screen-reader-only) paragraphs mentioning "No results" */
function visibleNoResults(wrapper: VueWrapper) {
  return wrapper.findAll('p').filter((p) => p.text().includes('No results'))
}

function tryAgain(wrapper: VueWrapper) {
  return wrapper.findAll('button').find((b) => b.text() === 'Try again')
}

function intersectAll(): void {
  FakeObserver.instances.forEach((o) => o.intersectAll())
}

describe('SearchView', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    FakeObserver.instances = []
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('debounce', () => {
    it('calls the API once with the trimmed query 500 ms after typing', async () => {
      fetchMock.mockResolvedValue(ok(page(['a', 'b'], null)))
      const wrapper = mountView()

      await type(wrapper, '  cats  ')
      await wait(499)
      expect(fetchMock).not.toHaveBeenCalled()

      await wait(1)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(firstPage('cats'), SIGNAL)
      expect(titles(wrapper)).toEqual(['Title a', 'Title b'])
    })

    it('restarts the debounce when typing again within 500 ms', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = mountView()

      await type(wrapper, 'ca')
      await wait(300)
      await type(wrapper, 'cats')
      await wait(300)
      expect(fetchMock).not.toHaveBeenCalled()

      await wait(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(firstPage('cats'), SIGNAL)
    })
  })

  describe('keyboard', () => {
    it('searches immediately on Enter without waiting for the debounce', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = mountView()

      await type(wrapper, ' cats ')
      await press(wrapper, 'Enter')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(firstPage('cats'), SIGNAL)
      expect(titles(wrapper)).toEqual(['Title a'])

      await wait(500)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('clears the input and the results on Escape without calling the API', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')
      expect(titles(wrapper)).toEqual(['Title a'])

      await press(wrapper, 'Escape')

      expect((input(wrapper).element as HTMLInputElement).value).toBe('')
      expect(titles(wrapper)).toEqual([])
      await wait(500)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('empty input', () => {
    it('clears the results and does not call the API after the debounce', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')
      expect(titles(wrapper)).toEqual(['Title a'])

      await type(wrapper, '   ')
      await wait(500)

      expect(titles(wrapper)).toEqual([])
      expect(visibleNoResults(wrapper)).toHaveLength(0)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('clears the results and does not call the API on Enter', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')

      await type(wrapper, '')
      await press(wrapper, 'Enter')

      expect(titles(wrapper)).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('same query again', () => {
    it('does not call the API again after a successful search', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], '1')))
      const wrapper = mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')

      await type(wrapper, ' cats')
      await press(wrapper, 'Enter')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(titles(wrapper)).toEqual(['Title a'])
    })

    it('retries a failed load-more with the previous offset and keeps the loaded GIFs', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
      fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
      const wrapper = mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')

      intersectAll()
      await flushPromises()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'search', query: 'cats', offset: '2' },
        SIGNAL
      )
      expect(wrapper.text()).toContain('Failed to load GIFs.')

      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      await press(wrapper, 'Enter')

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'search', query: 'cats', offset: '2' },
        SIGNAL
      )
      expect(titles(wrapper)).toEqual(['Title a', 'Title b'])

      d.resolve(ok(page(['c'], null)))
      await flushPromises()
      expect(titles(wrapper)).toEqual(['Title a', 'Title b', 'Title c'])
      expect(wrapper.text()).not.toContain('Failed to load GIFs.')
    })

    it('does not call the API again on intersection after a failed load-more', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
      fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
      const wrapper = mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')

      intersectAll()
      await flushPromises()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(tryAgain(wrapper)).toBeDefined()

      intersectAll()
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(titles(wrapper)).toEqual(['Title a', 'Title b'])
    })

    it('refetches the first page after a failed first page', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
      fetchMock.mockResolvedValueOnce(ok(page(['a'], null)))
      const wrapper = mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')
      expect(wrapper.text()).toContain('Failed to load GIFs.')

      await press(wrapper, 'Enter')

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenLastCalledWith(firstPage('cats'), SIGNAL)
      expect(titles(wrapper)).toEqual(['Title a'])
      expect(wrapper.text()).not.toContain('Failed to load GIFs.')
    })
  })

  describe('empty results', () => {
    it('shows one visible "No results" message for the fetched query and no error', async () => {
      fetchMock.mockResolvedValue(ok(page([], null)))
      const wrapper = mountView()
      await type(wrapper, 'zzz')
      await press(wrapper, 'Enter')

      const messages = visibleNoResults(wrapper)
      expect(messages).toHaveLength(1)
      expect(messages[0]?.text()).toContain('No results for “zzz”')
      expect(wrapper.find('.text-red-600').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Failed to load GIFs.')
      expect(tryAgain(wrapper)).toBeUndefined()
    })

    it('keeps showing the fetched query while a new query is typed, before the debounce fires', async () => {
      fetchMock.mockResolvedValue(ok(page([], null)))
      const wrapper = mountView()
      await type(wrapper, 'zzz')
      await press(wrapper, 'Enter')

      await type(wrapper, 'cats')
      await wait(100)

      const messages = visibleNoResults(wrapper)
      expect(messages).toHaveLength(1)
      expect(messages[0]?.text()).toContain('No results for “zzz”')
      expect(wrapper.text()).not.toContain('cats')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('shows no "No results" message before any search has run', async () => {
      const wrapper = mountView()
      expect(wrapper.text()).not.toContain('No results')

      await type(wrapper, 'zzz')
      await wait(100)

      expect(wrapper.text()).not.toContain('No results')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('errors', () => {
    it('shows "Failed to load GIFs." with a "Try again" button that retries', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
      fetchMock.mockResolvedValueOnce(ok(page(['a'], null)))
      const wrapper = mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')

      expect(wrapper.find('.text-red-600').text()).toContain('Failed to load GIFs.')
      const button = tryAgain(wrapper)
      expect(button).toBeDefined()
      expect(visibleNoResults(wrapper)).toHaveLength(0)

      await button?.trigger('click')
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenLastCalledWith(firstPage('cats'), SIGNAL)
      expect(titles(wrapper)).toEqual(['Title a'])
      expect(wrapper.text()).not.toContain('Failed to load GIFs.')
      expect(tryAgain(wrapper)).toBeUndefined()
    })
  })

  describe('unmount', () => {
    it('aborts the in-flight request', async () => {
      fetchMock.mockReturnValueOnce(deferred<GifsResult>().promise)
      const wrapper = mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')
      expect(signalOf(0)?.aborted).toBe(false)

      wrappers.splice(wrappers.indexOf(wrapper), 1)
      wrapper.unmount()

      expect(signalOf(0)?.aborted).toBe(true)
    })

    it('does not search after unmount when the debounce was pending', async () => {
      const wrapper = mountView()
      await type(wrapper, 'cats')

      wrappers.splice(wrappers.indexOf(wrapper), 1)
      wrapper.unmount()
      await wait(500)

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
