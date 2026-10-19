import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import TrendsView from '@/views/TrendsView.vue'
import SearchView from '@/views/SearchView.vue'
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

    const search = track(mount(SearchView))
    await flushPromises()

    expect(titles(search)).toEqual([])
    expect(search.text()).not.toContain('No results')
    expect(search.text()).not.toContain('Failed to load GIFs.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
