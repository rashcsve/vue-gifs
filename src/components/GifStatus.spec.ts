import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import GifStatus from '@/components/GifStatus.vue'

interface Props {
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  isEmpty: boolean
  count: number
  emptyMessage: string
}

const IDLE: Props = {
  isLoading: false,
  isLoadingMore: false,
  error: null,
  isEmpty: false,
  count: 0,
  emptyMessage: 'Nothing here.'
}

function mountStatus(props: Partial<Props> = {}): VueWrapper {
  return mount(GifStatus, { props: { ...IDLE, ...props } })
}

/** Text of the live region */
function message(wrapper: VueWrapper): string {
  return wrapper.get('[role="status"]').text().trim()
}

describe('GifStatus', () => {
  describe('live region', () => {
    it('renders a single polite, screen-reader-only status region as the root', () => {
      const wrapper = mountStatus()
      const root = wrapper.element as HTMLElement

      expect(root.tagName).toBe('DIV')
      expect(root.getAttribute('role')).toBe('status')
      expect(root.getAttribute('aria-live')).toBe('polite')
      expect(root.classList.contains('sr-only')).toBe(true)
      expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    })

    it('announces nothing when mounted idle with no GIFs', () => {
      expect(message(mountStatus())).toBe('')
    })

    it('announces nothing when mounted idle with GIFs already present', () => {
      expect(message(mountStatus({ count: 5 }))).toBe('')
    })
  })

  describe('loading states', () => {
    it('says "Loading GIFs…" while the first page loads', () => {
      expect(message(mountStatus({ isLoading: true }))).toBe('Loading GIFs…')
    })

    it('says "Loading more GIFs…" while a later page loads', () => {
      expect(message(mountStatus({ isLoadingMore: true, count: 3 }))).toBe('Loading more GIFs…')
    })

    it('prefers the loading message over a stale error and empty state', () => {
      const wrapper = mountStatus({ isLoading: true, error: 'Failed to load GIFs.', isEmpty: true })
      expect(message(wrapper)).toBe('Loading GIFs…')
    })

    it('prefers the loading-more message over a stale error', () => {
      const wrapper = mountStatus({ isLoadingMore: true, error: 'Failed to load GIFs.', count: 2 })
      expect(message(wrapper)).toBe('Loading more GIFs…')
    })
  })

  describe('error', () => {
    it('announces the error text when not loading', () => {
      expect(message(mountStatus({ error: 'Failed to load GIFs.' }))).toBe('Failed to load GIFs.')
    })

    it('prefers the error over the empty message', () => {
      const wrapper = mountStatus({ error: 'Failed to load GIFs.', isEmpty: true })
      expect(message(wrapper)).toBe('Failed to load GIFs.')
    })

    it('announces the error, not a loaded count, when the first page fails', async () => {
      const wrapper = mountStatus({ isLoading: true })
      await wrapper.setProps({ isLoading: false, error: 'Failed to load GIFs.' })
      expect(message(wrapper)).toBe('Failed to load GIFs.')
    })

    it('announces the error, not a loaded count, when a load-more fails', async () => {
      const wrapper = mountStatus({ count: 4 })
      await wrapper.setProps({ isLoadingMore: true })
      await wrapper.setProps({ isLoadingMore: false, error: 'Failed to load GIFs.' })
      expect(message(wrapper)).toBe('Failed to load GIFs.')
    })
  })

  describe('empty', () => {
    it('announces the emptyMessage prop verbatim', () => {
      const wrapper = mountStatus({ isEmpty: true, emptyMessage: 'No results for “zzz”' })
      expect(message(wrapper)).toBe('No results for “zzz”')
    })

    it('announces the empty message, not a count, after a first page with no GIFs', async () => {
      const wrapper = mountStatus({ isLoading: true, emptyMessage: 'Nothing here.' })
      await wrapper.setProps({ isLoading: false, isEmpty: true, count: 0 })
      expect(message(wrapper)).toBe('Nothing here.')
    })
  })

  describe('loaded', () => {
    it('says "{count} GIFs loaded" after the first page loads', async () => {
      const wrapper = mountStatus({ isLoading: true })
      await wrapper.setProps({ isLoading: false, count: 25 })
      expect(message(wrapper)).toBe('25 GIFs loaded')
    })

    it('says "1 GIF loaded" for a single GIF', async () => {
      const wrapper = mountStatus({ isLoading: true })
      await wrapper.setProps({ isLoading: false, count: 1 })
      expect(message(wrapper)).toBe('1 GIF loaded')
    })

    it('says "{added} more GIFs loaded, {count} total" after a later page loads', async () => {
      const wrapper = mountStatus({ count: 25 })
      await wrapper.setProps({ isLoadingMore: true })
      await wrapper.setProps({ isLoadingMore: false, count: 50 })
      expect(message(wrapper)).toBe('25 more GIFs loaded, 50 total')
    })

    it('says "1 more GIF loaded, {count} total" when a later page adds one GIF', async () => {
      const wrapper = mountStatus({ count: 25 })
      await wrapper.setProps({ isLoadingMore: true })
      await wrapper.setProps({ isLoadingMore: false, count: 26 })
      expect(message(wrapper)).toBe('1 more GIF loaded, 26 total')
    })

    it('counts added GIFs from when loading more started, even if count changes mid-load', async () => {
      const wrapper = mountStatus({ count: 10 })
      await wrapper.setProps({ isLoadingMore: true })
      await wrapper.setProps({ count: 15 })
      await wrapper.setProps({ isLoadingMore: false, count: 20 })
      expect(message(wrapper)).toBe('10 more GIFs loaded, 20 total')
    })

    it('announces nothing about new GIFs when a later page adds none', async () => {
      const wrapper = mountStatus({ count: 25 })
      await wrapper.setProps({ isLoadingMore: true })
      await wrapper.setProps({ isLoadingMore: false, count: 25 })
      expect(message(wrapper)).not.toMatch(/more GIFs? loaded/)
    })

    it('announces the new first page after a reload, replacing the previous message', async () => {
      const wrapper = mountStatus({ isLoading: true })
      await wrapper.setProps({ isLoading: false, count: 25 })
      expect(message(wrapper)).toBe('25 GIFs loaded')

      await wrapper.setProps({ isLoading: true, count: 0 })
      expect(message(wrapper)).toBe('Loading GIFs…')

      await wrapper.setProps({ isLoading: false, count: 3 })
      expect(message(wrapper)).toBe('3 GIFs loaded')
    })

    it('clears a loaded message when the results are reset without loading', async () => {
      const wrapper = mountStatus({ isLoading: true })
      await wrapper.setProps({ isLoading: false, count: 25 })
      expect(message(wrapper)).toBe('25 GIFs loaded')

      await wrapper.setProps({ count: 0 })

      expect(message(wrapper)).toBe('')
    })

    it('replaces a loaded message with the empty message when results are cleared', async () => {
      const wrapper = mountStatus({ isLoading: true })
      await wrapper.setProps({ isLoading: false, count: 2 })
      await wrapper.setProps({ isLoading: true, count: 0 })
      await wrapper.setProps({ isLoading: false, isEmpty: true })
      expect(message(wrapper)).toBe('Nothing here.')
    })
  })
})
