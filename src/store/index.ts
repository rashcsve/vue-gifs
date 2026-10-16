// src/store/index.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchGifsFromApi, type Category, type GifItem } from '@/services'

/**
 * Pinia store for GIFs
 * - Handles first-page vs. load-more states
 * - Aborts superseded requests and ignores their late responses via requestId
 * - Surfaces human-friendly error messages
 */
export const useGifsStore = defineStore('gifs', () => {
  // --- STATE ---
  const gifs = ref<GifItem[]>([]) // All loaded GIFs
  const isLoading = ref(false) // Loading state for first page
  const isLoadingMore = ref(false) // Loading state for subsequent pages
  const error = ref<string | null>(null) // Error message or null if no error
  const next = ref<string | null>(null) // Next-page token from API (a.k.a. offset)

  // Tracks the latest request to avoid updating state from out-of-order responses
  let requestId = 0
  // Aborts the in-flight request when it is superseded or cancelled
  let controller: AbortController | null = null

  // Derived flag: do we have more to load?
  const hasMore = computed(() => Boolean(next.value))

  // --- ACTIONS ---

  /**
   * Abort the in-flight request (e.g. on route change) and keep the loaded data.
   */
  function cancel() {
    controller?.abort()
    controller = null
    // Invalidate in-flight requests; resetting to 0 would let a new request reuse their ID
    requestId++
    _clearLoading()
  }

  /**
   * Reset store to a clean state (use before starting a new query/category).
   */
  function $reset() {
    cancel()
    gifs.value = []
    error.value = null
    next.value = null
  }

  /**
   * Toggle loading flags depending on whether it's the first page or a "load more".
   */
  function _setLoading(firstPage: boolean) {
    if (firstPage) {
      isLoading.value = true
      isLoadingMore.value = false
    } else {
      isLoadingMore.value = true
    }
  }

  /**
   * Clear both loading flags.
   */
  function _clearLoading() {
    isLoading.value = false
    isLoadingMore.value = false
  }

  /**
   * Fetch GIFs from API.
   * - If `next` is null, it's treated as the first page after a reset.
   * - Uses `requestId` to ensure only the latest request updates the state.
   */
  async function fetchGifs(opts: { query?: string; category?: Category } = {}) {
    const { query, category } = opts
    const firstPage = !next.value // first request after reset

    _setLoading(firstPage)
    error.value = null

    // Unique ID for this request (guards against out-of-order responses)
    const myId = ++requestId
    controller?.abort()
    controller = new AbortController()

    try {
      const result = await fetchGifsFromApi(
        { query, category, offset: next.value ?? null },
        { signal: controller.signal }
      )

      // Ignore outdated responses (if a newer request has been made)
      if (myId !== requestId) return

      if (!result.ok) {
        if (result.error.kind === 'aborted') return
        console.error('[gifs] fetch failed:', result.error)
        error.value = 'Failed to load GIFs.'
        next.value = null
        return
      }

      const { results, next: nextOffset } = result.data

      // Merge for "load more", replace for first page
      gifs.value = firstPage ? results : [...gifs.value, ...results]
      next.value = nextOffset

      // Show user-friendly "no results" only for the first page
      if (firstPage && gifs.value.length === 0) {
        error.value = 'No GIFs found.'
      }
    } catch (err) {
      // Also ignore errors from outdated responses
      if (myId !== requestId) return

      console.error('[gifs] fetch threw:', err)
      error.value = 'Failed to load GIFs.'
      next.value = null
    } finally {
      // Only clear loading if this is still the latest request
      if (myId === requestId) {
        _clearLoading()
        controller = null
      }
    }
  }

  return {
    // State
    gifs,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    next,

    // Actions
    $reset,
    cancel,
    fetchGifs
  }
})
