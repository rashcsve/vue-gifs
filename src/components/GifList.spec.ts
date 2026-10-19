import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import GifList from '@/components/GifList.vue'
import type { GifItem } from '@/services'
import { FakeObserver, gifs } from '@/test/helpers'

function observedCount(): number {
  return FakeObserver.instances.reduce((n, o) => n + o.observed.size, 0)
}

function observedElements(): Element[] {
  return FakeObserver.instances.flatMap((o) => [...o.observed])
}

function intersectAll(): void {
  FakeObserver.instances.forEach((o) => o.intersectAll())
}

interface Props {
  gifs: GifItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  paused: boolean
}

/**
 * Behaves like a real IntersectionObserver for a target that is already on
 * screen: observe() reports it as intersecting on the next microtask.
 */
class EagerObserver extends FakeObserver {
  override observe(target: Element): void {
    super.observe(target)
    queueMicrotask(() => {
      if (this.observed.has(target)) this.intersectAll()
    })
  }
}

const onLoadMore = vi.fn()

/**
 * The load-more listener is passed as `onLoadMore`, which Vue calls for both
 * `emit('load-more')` and `emit('loadMore')`.
 */
function mountList(props: Partial<Props> = {}): VueWrapper {
  return mount(GifList, {
    props: { gifs: [], isLoading: false, isLoadingMore: false, hasMore: false, ...props },
    attrs: { onLoadMore }
  })
}

/** Mirrors the real flow: mount while the first page loads, then the page arrives */
async function mountLoaded(props: Partial<Props>): Promise<VueWrapper> {
  const wrapper = mountList({ isLoading: true })
  await wrapper.setProps({ isLoading: false, ...props })
  return wrapper
}

describe('GifList', () => {
  beforeEach(() => {
    FakeObserver.instances = []
    onLoadMore.mockReset()
    vi.stubGlobal('IntersectionObserver', FakeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders one item per gif without needing a store', () => {
      const wrapper = mountList({ gifs: gifs('a', 'b', 'c') })
      const items = wrapper.findAll('[title^="Title "]')
      expect(items.map((el) => el.attributes('title'))).toEqual(['Title a', 'Title b', 'Title c'])
    })

    it('renders no items for an empty list', () => {
      const wrapper = mountList({ gifs: [] })
      expect(wrapper.findAll('[title^="Title "]')).toHaveLength(0)
    })

    it('shows "Loading…" while the first page loads', () => {
      const wrapper = mountList({ isLoading: true })
      expect(wrapper.text()).toContain('Loading…')
      expect(wrapper.text()).not.toContain('Loading more…')
    })

    it('shows "Loading more…" while a later page loads, with the loaded items', () => {
      const wrapper = mountList({ gifs: gifs('a'), isLoadingMore: true, hasMore: true })
      expect(wrapper.text()).toContain('Loading more…')
      expect(wrapper.findAll('[title^="Title "]')).toHaveLength(1)
    })

    it('shows no loading text when idle', () => {
      const wrapper = mountList({ gifs: gifs('a') })
      expect(wrapper.text()).not.toContain('Loading')
    })

    it('renders each gif as a lazy img with src and alt', () => {
      const wrapper = mountList({ gifs: gifs('a', 'b') })
      const imgs = wrapper.findAll('img')
      expect(imgs).toHaveLength(2)
      expect(imgs.map((img) => img.attributes('loading'))).toEqual(['lazy', 'lazy'])
      expect(imgs.map((img) => img.attributes('src'))).toEqual([
        'https://x/a.gif',
        'https://x/b.gif'
      ])
      expect(imgs.map((img) => img.attributes('alt'))).toEqual(['Title a', 'Title b'])
    })

    it('uses alt="GIF" for a gif with an empty title', () => {
      const wrapper = mountList({ gifs: [{ id: 'x', title: '', url: 'https://x/x.gif' }] })
      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('alt')).toBe('GIF')
    })

    it('renders no error message', () => {
      const wrapper = mountList({ gifs: [] })
      expect(wrapper.text()).not.toMatch(/failed|no gifs found/i)
      expect(wrapper.find('.text-red-600').exists()).toBe(false)
    })
  })

  describe('load more', () => {
    it('emits load-more when the last item intersects and more pages exist', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true })
      expect(observedCount()).toBeGreaterThan(0)

      intersectAll()

      expect(onLoadMore).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    })

    it('does not observe or emit when hasMore is false', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: false })

      intersectAll()

      expect(onLoadMore).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('does not emit when hasMore turns false before the item intersects', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true })
      await wrapper.setProps({ hasMore: false })

      intersectAll()

      expect(onLoadMore).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('does not emit while a later page is loading', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true })
      await wrapper.setProps({ isLoadingMore: true })

      intersectAll()

      expect(onLoadMore).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('does not emit while the first page is loading', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true })
      const observers = [...FakeObserver.instances]
      const targets = observers.map((o) => [...o.observed])
      await wrapper.setProps({ isLoading: true })

      // Report the previously observed items even if the list has hidden them
      observers.forEach((o, i) => targets[i]?.forEach((t) => o.observe(t)))
      intersectAll()

      expect(onLoadMore).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('observes exactly one sentinel, not a gif item, when more pages exist and idle', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b', 'c'), hasMore: true })

      const observed = observedElements()
      expect(observed).toHaveLength(1)
      const [sentinel] = observed
      const imgs = wrapper.findAll('img').map((img) => img.element)
      const items = wrapper.findAll('[title^="Title "]').map((item) => item.element)
      expect(imgs).not.toContain(sentinel)
      expect(items).not.toContain(sentinel)
      expect(sentinel?.querySelector('img, [title^="Title "]')).toBeNull()
      wrapper.unmount()
    })

    it('observes nothing while a later page is loading', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true })
      await wrapper.setProps({ isLoadingMore: true })

      expect(observedCount()).toBe(0)
      wrapper.unmount()
    })

    it('observes nothing when mounted while a later page is loading', async () => {
      const wrapper = mountList({ gifs: gifs('a', 'b'), hasMore: true, isLoadingMore: true })
      await wrapper.vm.$nextTick()

      expect(observedCount()).toBe(0)
      wrapper.unmount()
    })

    it('observes nothing when hasMore is false', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: false })

      expect(observedCount()).toBe(0)
      wrapper.unmount()
    })

    it('stops observing when hasMore turns false', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true })
      await wrapper.setProps({ hasMore: false })

      expect(observedCount()).toBe(0)
      wrapper.unmount()
    })

    it('observes the sentinel when mounted with gifs already present', async () => {
      const wrapper = mountList({ gifs: gifs('a', 'b'), hasMore: true })
      await wrapper.vm.$nextTick()

      expect(observedCount()).toBe(1)
      intersectAll()

      expect(onLoadMore).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    })

    it('observes the sentinel again after a failed load-more so scrolling retries', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true })
      intersectAll()
      expect(onLoadMore).toHaveBeenCalledTimes(1)

      // Parent starts loading, then the request fails: same gifs, hasMore still true
      await wrapper.setProps({ isLoadingMore: true })
      await wrapper.setProps({ isLoadingMore: false })

      expect(observedCount()).toBe(1)
      intersectAll()

      expect(onLoadMore).toHaveBeenCalledTimes(2)
      wrapper.unmount()
    })
  })

  describe('paused', () => {
    it('observes nothing and emits nothing while paused, even with more pages and idle', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true, paused: true })

      expect(observedCount()).toBe(0)
      intersectAll()

      expect(onLoadMore).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('observes the sentinel again when unpaused, and an intersection emits load-more', async () => {
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true, paused: true })
      expect(observedCount()).toBe(0)

      await wrapper.setProps({ paused: false })

      expect(observedCount()).toBe(1)
      intersectAll()

      expect(onLoadMore).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    })

    it('does not auto-retry a failed load-more with a visible sentinel until unpaused', async () => {
      vi.stubGlobal('IntersectionObserver', EagerObserver)
      const wrapper = await mountLoaded({ gifs: gifs('a', 'b'), hasMore: true })
      await flushPromises()
      expect(onLoadMore).toHaveBeenCalledTimes(1)

      // Parent starts loading, then the request fails and the parent pauses the list
      await wrapper.setProps({ isLoadingMore: true })
      await wrapper.setProps({ isLoadingMore: false, paused: true })
      await flushPromises()

      expect(onLoadMore).toHaveBeenCalledTimes(1)

      // User retried successfully: loading resumes while the sentinel is still visible
      await wrapper.setProps({ paused: false })
      await flushPromises()

      expect(onLoadMore).toHaveBeenCalledTimes(2)
      wrapper.unmount()
    })
  })
})
