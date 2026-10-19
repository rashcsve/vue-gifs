import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import TrendsView from '@/views/TrendsView.vue'
import SearchView from '@/views/SearchView.vue'
import { RouteName } from '@/router/names'
import { fetchGifsFromApi } from '@/services'
import { deferred, fail, FakeObserver, ok, page, type GifsResult } from '@/test/helpers'

vi.mock('@/services', () => ({ fetchGifsFromApi: vi.fn() }))

const fetchMock = vi.mocked(fetchGifsFromApi)

const SIGNAL = { signal: expect.any(AbortSignal) }
const TRENDS_FIRST_PAGE = { category: 'trends', query: undefined, offset: null }

/** Signal passed to the nth (0-based) fetchGifsFromApi call */
function signalOf(call: number): AbortSignal | undefined {
  return fetchMock.mock.calls[call]?.[1]?.signal
}

const wrappers: VueWrapper[] = []

function track(wrapper: VueWrapper): VueWrapper {
  wrappers.push(wrapper)
  return wrapper
}

function untrack(wrapper: VueWrapper): void {
  wrappers.splice(wrappers.indexOf(wrapper), 1)
}

function titles(wrapper: VueWrapper): (string | undefined)[] {
  return wrapper.findAll('[title^="Title "]').map((el) => el.attributes('title'))
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

/** Mount SearchView with a memory router at `/search` (SearchView reads/writes ?q=) */
async function mountSearchView(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: RouteName.Trends, component: { render: () => null } },
      { path: '/search', name: RouteName.Search, component: SearchView }
    ]
  })
  await router.push('/search')
  await router.isReady()
  return mount(SearchView, { global: { plugins: [router] } })
}

describe('TrendsView', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    FakeObserver.instances = []
    vi.stubGlobal('IntersectionObserver', FakeObserver)
  })

  afterEach(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads trending GIFs once on mount and renders them', async () => {
    fetchMock.mockResolvedValue(ok(page(['a', 'b'], '2')))
    const wrapper = track(mount(TrendsView))
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(TRENDS_FIRST_PAGE, SIGNAL)
    expect(titles(wrapper)).toEqual(['Title a', 'Title b'])
    expect(wrapper.find('.text-red-600').exists()).toBe(false)
  })

  it('shows "No trending GIFs right now." for an empty first page, without an error', async () => {
    fetchMock.mockResolvedValue(ok(page([], null)))
    const wrapper = track(mount(TrendsView))
    await flushPromises()

    expect(wrapper.text()).toContain('No trending GIFs right now.')
    expect(wrapper.find('.text-red-600').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Failed to load GIFs.')
    expect(tryAgain(wrapper)).toBeUndefined()
  })

  it('shows "Failed to load GIFs." with "Try again", which retries and renders the GIFs', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
    fetchMock.mockResolvedValueOnce(ok(page(['a'], null)))
    const wrapper = track(mount(TrendsView))
    await flushPromises()

    expect(wrapper.find('.text-red-600').text()).toContain('Failed to load GIFs.')
    expect(wrapper.text()).not.toContain('No trending GIFs')
    const button = tryAgain(wrapper)
    expect(button).toBeDefined()

    await button?.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(TRENDS_FIRST_PAGE, SIGNAL)
    expect(titles(wrapper)).toEqual(['Title a'])
    expect(wrapper.text()).not.toContain('Failed to load GIFs.')
    expect(tryAgain(wrapper)).toBeUndefined()
  })

  it('aborts the in-flight request on unmount', () => {
    fetchMock.mockReturnValueOnce(deferred<GifsResult>().promise)
    const wrapper = mount(TrendsView)
    expect(signalOf(0)?.aborted).toBe(false)

    wrapper.unmount()

    expect(signalOf(0)?.aborted).toBe(true)
  })

  it('does not call the API again on intersection after a failed load-more until "Try again" succeeds', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
    fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
    const wrapper = track(mount(TrendsView))
    await flushPromises()

    intersectAll()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Failed to load GIFs.')
    expect(tryAgain(wrapper)).toBeDefined()

    // Sentinel still on screen: no automatic retry
    intersectAll()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Manual retry succeeds, then scrolling loads the next page again
    fetchMock.mockResolvedValueOnce(ok(page(['c'], '3')))
    await tryAgain(wrapper)?.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(titles(wrapper)).toEqual(['Title a', 'Title b', 'Title c'])

    fetchMock.mockResolvedValueOnce(ok(page(['d'], null)))
    intersectAll()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(titles(wrapper)).toEqual(['Title a', 'Title b', 'Title c', 'Title d'])
  })

  it('does not leak trending GIFs into a SearchView mounted afterwards', async () => {
    fetchMock.mockResolvedValue(ok(page(['t1', 't2'], '2')))
    const trends = track(mount(TrendsView))
    await flushPromises()
    expect(titles(trends)).toEqual(['Title t1', 'Title t2'])
    untrack(trends)
    trends.unmount()

    const search = track(await mountSearchView())
    await flushPromises()

    expect(titles(search)).toEqual([])
    expect(search.text()).not.toContain('No results')
    expect(search.text()).not.toContain('Failed to load GIFs.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  describe('accessibility', () => {
    describe('focus after "Try again"', () => {
      it('moves focus to the GIF list after retrying a failed load-more, and keeps it there', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
        fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
        const wrapper = track(mount(TrendsView, { attachTo: document.body }))
        await flushPromises()
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
        fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
        const wrapper = track(mount(TrendsView, { attachTo: document.body }))
        await flushPromises()

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
      fetchMock.mockResolvedValue(ok(page(['a', 'b'], '2')))
      const wrapper = track(mount(TrendsView))
      await flushPromises()

      expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
      expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
    })

    it('announces "Loading GIFs…" and then "N GIFs loaded" for the first page', async () => {
      const d = deferred<GifsResult>()
      fetchMock.mockReturnValueOnce(d.promise)
      const wrapper = track(mount(TrendsView))
      await flushPromises()
      expect(status(wrapper)).toBe('Loading GIFs…')

      d.resolve(ok(page(['a', 'b', 'c'], '3')))
      await flushPromises()

      expect(status(wrapper)).toBe('3 GIFs loaded')
    })

    it('announces how many GIFs a later page added', async () => {
      fetchMock.mockResolvedValueOnce(ok(page(['a', 'b'], '2')))
      fetchMock.mockResolvedValueOnce(ok(page(['c'], null)))
      const wrapper = track(mount(TrendsView))
      await flushPromises()

      intersectAll()
      await flushPromises()

      expect(titles(wrapper)).toEqual(['Title a', 'Title b', 'Title c'])
      expect(status(wrapper)).toBe('1 more GIF loaded, 3 total')
    })

    it('announces the empty message in the status region for an empty first page', async () => {
      fetchMock.mockResolvedValue(ok(page([], null)))
      const wrapper = track(mount(TrendsView))
      await flushPromises()

      expect(status(wrapper)).toBe('No trending GIFs right now. Please try again.')
    })

    it('announces the error in the status region when the first page fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const wrapper = track(mount(TrendsView))
      await flushPromises()

      expect(status(wrapper)).toBe('Failed to load GIFs.')
    })

    it('shows a first-page error above the list area', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const wrapper = track(mount(TrendsView))
      await flushPromises()

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
      fetchMock.mockResolvedValueOnce(fail({ kind: 'network', cause: new TypeError('offline') }))
      const wrapper = track(mount(TrendsView))
      await flushPromises()

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
        { category: 'trends', query: undefined, offset: '2' },
        SIGNAL
      )
      expect(titles(wrapper)).toEqual(['Title a', 'Title b', 'Title c'])
      expect(wrapper.find('.text-red-600').exists()).toBe(false)
    })
  })
})
