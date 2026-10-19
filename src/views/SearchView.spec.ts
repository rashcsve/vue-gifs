import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import SearchView from '@/views/SearchView.vue'
import { RouteName } from '@/router/names'
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

/** Router of the most recent mountView() */
let router: Router

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: RouteName.Trends, component: { render: () => null } },
      { path: '/search', name: RouteName.Search, component: SearchView }
    ]
  })
}

/**
 * Mount SearchView with a memory router at `path`.
 * `from`, if given, is visited first so history has an entry before the search page.
 */
async function mountView(path = '/search', from?: string): Promise<VueWrapper> {
  router = makeRouter()
  if (from) await router.push(from)
  await router.push(path)
  await router.isReady()
  const wrapper = mount(SearchView, { global: { plugins: [router] } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

/** Current route query */
function routeQuery() {
  return router.currentRoute.value.query
}

function inputValue(wrapper: VueWrapper): string {
  return input(wrapper).element.value
}

function input(wrapper: VueWrapper) {
  return wrapper.get<HTMLInputElement>('input[aria-label="Search GIFs"]')
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

/** Text of the screen-reader live region (exactly one is expected) */
function status(wrapper: VueWrapper): string {
  const regions = wrapper.findAll('[role="status"]')
  expect(regions).toHaveLength(1)
  return regions[0]?.text().trim() ?? ''
}

/** True when `a` comes before `b` in document order */
function isBefore(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
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
      const wrapper = await mountView()

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
      const wrapper = await mountView()

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
      const wrapper = await mountView()

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
      const wrapper = await mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')
      expect(titles(wrapper)).toEqual(['Title a'])

      await press(wrapper, 'Escape')

      expect(input(wrapper).element.value).toBe('')
      expect(titles(wrapper)).toEqual([])
      await wait(500)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('empty input', () => {
    it('clears the results and does not call the API after the debounce', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView()
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
      const wrapper = await mountView()
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
      const wrapper = await mountView()
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
      const wrapper = await mountView()
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
      const wrapper = await mountView()
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
      const wrapper = await mountView()
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
      const wrapper = await mountView()
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
      const wrapper = await mountView()
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
      const wrapper = await mountView()
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
      const wrapper = await mountView()
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
      const wrapper = await mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')
      expect(signalOf(0)?.aborted).toBe(false)

      wrappers.splice(wrappers.indexOf(wrapper), 1)
      wrapper.unmount()

      expect(signalOf(0)?.aborted).toBe(true)
    })

    it('does not search after unmount when the debounce was pending', async () => {
      const wrapper = await mountView()
      await type(wrapper, 'cats')

      wrappers.splice(wrappers.indexOf(wrapper), 1)
      wrapper.unmount()
      await wait(500)

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('URL query (?q=)', () => {
    it('fills the input and fetches the first page immediately when mounted with ?q=', async () => {
      fetchMock.mockResolvedValue(ok(page(['a', 'b'], null)))
      const wrapper = await mountView('/search?q=cats')

      expect(inputValue(wrapper)).toBe('cats')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(firstPage('cats'), SIGNAL)
      expect(titles(wrapper)).toEqual(['Title a', 'Title b'])

      await wait(500)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not fetch when mounted with a whitespace-only ?q=', async () => {
      const wrapper = await mountView('/search?q=%20%20')
      await wait(500)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(titles(wrapper)).toEqual([])
      expect(wrapper.text()).not.toContain('No results')
    })

    it('does not fetch when mounted with an empty ?q=', async () => {
      const wrapper = await mountView('/search?q=')
      await wait(500)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(inputValue(wrapper)).toBe('')
    })

    it('does not fetch or set ?q= when mounted without a query', async () => {
      await mountView('/search')
      await wait(500)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(routeQuery()).toEqual({})
    })

    it('sets ?q= to the trimmed query when the debounce fires, and not before', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView()

      await type(wrapper, '  cats  ')
      await wait(499)
      expect(routeQuery()).toEqual({})

      await wait(1)
      expect(routeQuery()).toEqual({ q: 'cats' })
      expect(router.currentRoute.value.path).toBe('/search')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('sets ?q= to the trimmed query on Enter and fetches only once', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView()

      await type(wrapper, ' cats ')
      await press(wrapper, 'Enter')

      expect(routeQuery()).toEqual({ q: 'cats' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(firstPage('cats'), SIGNAL)
      expect(titles(wrapper)).toEqual(['Title a'])
    })

    it('replaces the history entry instead of pushing a new one', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView('/search', '/')

      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')
      await type(wrapper, 'dogs')
      await wait(500)
      expect(routeQuery()).toEqual({ q: 'dogs' })

      router.back()
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/')
    })

    it('removes ?q= and clears the results on Enter with an empty input', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView('/search?q=cats')
      expect(titles(wrapper)).toEqual(['Title a'])

      await type(wrapper, '   ')
      await press(wrapper, 'Enter')

      expect(routeQuery()).toEqual({})
      expect(router.currentRoute.value.fullPath).toBe('/search')
      expect(titles(wrapper)).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('removes ?q= when the debounce fires with an empty input', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView('/search?q=cats')

      await type(wrapper, '')
      await wait(500)

      expect(routeQuery()).toEqual({})
      expect(titles(wrapper)).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not refetch when Enter repeats the query loaded from the URL', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView('/search?q=cats')

      await press(wrapper, 'Enter')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(routeQuery()).toEqual({ q: 'cats' })
      expect(titles(wrapper)).toEqual(['Title a'])
    })

    it('retries on Enter when the query loaded from the URL failed', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
      fetchMock.mockResolvedValueOnce(ok(page(['a'], null)))
      const wrapper = await mountView('/search?q=cats')
      expect(wrapper.text()).toContain('Failed to load GIFs.')

      await press(wrapper, 'Enter')

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenLastCalledWith(firstPage('cats'), SIGNAL)
      expect(titles(wrapper)).toEqual(['Title a'])
    })
  })

  describe('Escape', () => {
    it('cancels the pending debounce: no fetch and no ?q=, even after the delay', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView()

      await type(wrapper, 'cats')
      await wait(200)
      await press(wrapper, 'Escape')
      await wait(1000)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(routeQuery()).toEqual({})
      expect(inputValue(wrapper)).toBe('')
      expect(titles(wrapper)).toEqual([])
    })

    it('removes ?q=, clears the input and the results after a search', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView('/search?q=cats')
      expect(titles(wrapper)).toEqual(['Title a'])

      await press(wrapper, 'Escape')

      expect(routeQuery()).toEqual({})
      expect(router.currentRoute.value.fullPath).toBe('/search')
      expect(inputValue(wrapper)).toBe('')
      expect(titles(wrapper)).toEqual([])
      expect(wrapper.text()).not.toContain('No results')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('cancels a pending debounce for a new query typed after a search', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView('/search?q=cats')

      await type(wrapper, 'dogs')
      await wait(100)
      await press(wrapper, 'Escape')
      await wait(1000)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(routeQuery()).toEqual({})
      expect(inputValue(wrapper)).toBe('')
    })
  })

  describe('external route changes', () => {
    it('clears the input and the results when navigating to /search without ?q=', async () => {
      fetchMock.mockResolvedValue(ok(page(['a'], null)))
      const wrapper = await mountView('/search?q=cats')
      expect(titles(wrapper)).toEqual(['Title a'])

      await router.push('/search')
      await flushPromises()

      expect(inputValue(wrapper)).toBe('')
      expect(titles(wrapper)).toEqual([])
      expect(wrapper.text()).not.toContain('No results')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('loads the new query and fills the input when navigating to another ?q=', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a'], null)))
      fetchMock.mockResolvedValueOnce(ok(page(['d'], null)))
      const wrapper = await mountView('/search?q=cats')

      await router.push('/search?q=dogs')
      await flushPromises()

      expect(inputValue(wrapper)).toBe('dogs')
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenLastCalledWith(firstPage('dogs'), SIGNAL)
      expect(titles(wrapper)).toEqual(['Title d'])
    })

    it('cancels a pending debounce when the route changes externally', async () => {
      fetchMock.mockResolvedValue(ok(page(['d'], null)))
      const wrapper = await mountView()

      await type(wrapper, 'cats')
      await router.push('/search?q=dogs')
      await flushPromises()
      await wait(1000)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(firstPage('dogs'), SIGNAL)
      expect(routeQuery()).toEqual({ q: 'dogs' })
      expect(inputValue(wrapper)).toBe('dogs')
    })
  })

  describe('accessibility', () => {
    /** Like mountView, but attached to document.body so focus can be checked */
    async function mountAttached(path: string): Promise<VueWrapper> {
      router = makeRouter()
      await router.push(path)
      await router.isReady()
      const wrapper = mount(SearchView, { global: { plugins: [router] }, attachTo: document.body })
      wrappers.push(wrapper)
      await flushPromises()
      return wrapper
    }

    it('clears the status text when Escape clears the results', async () => {
      fetchMock.mockResolvedValue(ok(page(['a', 'b', 'c'], null)))
      const wrapper = await mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')
      expect(status(wrapper)).toBe('3 GIFs loaded')

      await press(wrapper, 'Escape')

      expect(titles(wrapper)).toEqual([])
      expect(status(wrapper)).toBe('')
    })

    describe('focus after "Try again"', () => {
      it('moves focus to the GIF list after retrying a failed load-more, and keeps it there', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
        fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
        const wrapper = await mountAttached('/search?q=cats')
        intersectAll()
        await flushPromises()

        const list = wrapper.get('ul')
        expect(list.attributes('tabindex')).toBe('-1')
        const button = tryAgain(wrapper)
        expect(button).toBeDefined()
        ;(button?.element as HTMLButtonElement).focus()
        expect(document.activeElement).toBe(button?.element)

        const d = deferred<GifsResult>()
        fetchMock.mockReturnValueOnce(d.promise)
        await button?.trigger('click')
        await flushPromises()

        expect(document.activeElement).not.toBe(document.body)
        expect(document.activeElement).toBe(wrapper.get('ul').element)

        d.resolve(ok(page(['c'], null)))
        await flushPromises()

        expect(tryAgain(wrapper)).toBeUndefined()
        expect(titles(wrapper)).toEqual(['Title a', 'Title b', 'Title c'])
        expect(document.activeElement).toBe(wrapper.get('ul').element)
      })

      it('moves focus to the heading after retrying a failed first page, and keeps it there', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
        const wrapper = await mountAttached('/search?q=cats')

        const heading = wrapper.get('h1')
        expect(heading.attributes('tabindex')).toBe('-1')
        const button = tryAgain(wrapper)
        expect(button).toBeDefined()
        ;(button?.element as HTMLButtonElement).focus()
        expect(document.activeElement).toBe(button?.element)

        const d = deferred<GifsResult>()
        fetchMock.mockReturnValueOnce(d.promise)
        await button?.trigger('click')
        await flushPromises()

        expect(document.activeElement).not.toBe(document.body)
        expect(document.activeElement).toBe(heading.element)

        d.resolve(ok(page(['a'], null)))
        await flushPromises()

        expect(tryAgain(wrapper)).toBeUndefined()
        expect(titles(wrapper)).toEqual(['Title a'])
        expect(document.activeElement).toBe(heading.element)
      })
    })

    it('renders exactly one status live region', async () => {
      const wrapper = await mountView()

      expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
      expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
    })

    it('announces nothing before any search has run', async () => {
      const wrapper = await mountView()
      expect(status(wrapper)).toBe('')
    })

    it('announces "Loading GIFs…" and then "N GIFs loaded" for the first page', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const wrapper = await mountView()
      await type(wrapper, 'cats')
      await press(wrapper, 'Enter')
      expect(status(wrapper)).toBe('Loading GIFs…')

      d.resolve(ok(page(['a', 'b'], '2')))
      await flushPromises()

      expect(status(wrapper)).toBe('2 GIFs loaded')
    })

    it('announces the no-results message with curly quotes in the status region', async () => {
      fetchMock.mockResolvedValue(ok(page([], null)))
      const wrapper = await mountView()
      await type(wrapper, 'zzz')
      await press(wrapper, 'Enter')

      expect(status(wrapper)).toContain('No results for “zzz”')
      expect(status(wrapper)).not.toContain('"zzz"')
    })

    it('announces the error in the status region when the first page fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
      const wrapper = await mountView('/search?q=cats')

      expect(status(wrapper)).toBe('Failed to load GIFs.')
    })

    it('shows a first-page error above the list area', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
      const wrapper = await mountView('/search?q=cats')

      const errors = wrapper.findAll('.text-red-600')
      expect(errors).toHaveLength(1)
      expect(errors[0]?.text()).toContain('Failed to load GIFs.')
      const list = wrapper.find('ul')
      expect(list.exists()).toBe(true)
      const error = errors[0]
      expect(error && isBefore(error.element, list.element)).toBe(true)
    })

    it('shows one load-more error below the GIF list, and "Try again" retries the load-more', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
      fetchMock.mockResolvedValueOnce(NETWORK_ERROR)
      const wrapper = await mountView('/search?q=cats')

      intersectAll()
      await flushPromises()

      const errors = wrapper.findAll('.text-red-600')
      expect(errors).toHaveLength(1)
      const error = errors[0]
      expect(error?.text()).toContain('Failed to load GIFs.')
      expect(error?.findAll('button').some((b) => b.text() === 'Try again')).toBe(true)
      const list = wrapper.get('ul')
      expect(list.findAll('img')).toHaveLength(2)
      expect(error && isBefore(list.element, error.element)).toBe(true)

      fetchMock.mockResolvedValueOnce(ok(page(['c'], null)))
      await tryAgain(wrapper)?.trigger('click')
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(fetchMock).toHaveBeenLastCalledWith(
        { category: 'search', query: 'cats', offset: '2' },
        SIGNAL
      )
      expect(titles(wrapper)).toEqual(['Title a', 'Title b', 'Title c'])
      expect(wrapper.find('.text-red-600').exists()).toBe(false)
    })
  })
})
