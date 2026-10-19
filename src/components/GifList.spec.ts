import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import GifList from '@/components/GifList.vue'
import type { GifItem } from '@/services'
import { FakeObserver, gifs } from '@/test/helpers'

function observedCount(): number {
  return FakeObserver.instances.reduce((n, o) => n + o.observed.size, 0)
}

function intersectAll(): void {
  FakeObserver.instances.forEach((o) => o.intersectAll())
}

interface Props {
  gifs: GifItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
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
  })
})
