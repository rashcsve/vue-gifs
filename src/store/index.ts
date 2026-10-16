// src/store/index.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchGifsFromApi,
  type Category,
  type GifsResponse,
  type GifItem
} from '@/services'

/**
 * Pinia store for GIFs
 * - Handles first-page vs. load-more states
 * - Prevents race conditions via requestId
 * - Surfaces human-friendly error messages
 */
export const useGifsStore = defineStore('gifs', () => {
  // --- STATE ---
  const gifs = ref<GifItem[]>([])          // All loaded GIFs
  const isLoading = ref(false)             // Loading state for first page
  const isLoadingMore = ref(false)         // Loading state for subsequent pages
  const error = ref<string | null>(null)   // Error message or null if no error
  const next = ref<string | null>(null)    // Next-page token from API (a.k.a. offset)

  // Tracks the latest request to avoid updating state from out-of-order responses
  let requestId = 0

  // Derived flag: do we have more to load?
  const hasMore = computed(() => Boolean(next.value))

  // --- ACTIONS ---

  /**
   * Reset store to a clean state (use before starting a new query/category).
   */
  function $reset() {
    gifs.value = []
    isLoading.value = false
    isLoadingMore.value = false
    error.value = null
    next.value = null
    requestId = 0
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

    try {
      const data = (await fetchGifsFromApi({
        query,
        category,
        offset: next.value ?? null
      })) as GifsResponse | null

      // Ignore outdated responses (if a newer request has been made)
      if (myId !== requestId) return

      // Validate the API response shape (defensive programming)
      if (!data || !Array.isArray(data.results)) {
        throw new Error('Invalid API response')
      }

      const incoming = data.results ?? []

      // Merge for "load more", replace for first page
      gifs.value = firstPage ? incoming : [...gifs.value, ...incoming]
      next.value = data.next ?? null

      // Show user-friendly "no results" only for the first page
      if (firstPage && gifs.value.length === 0) {
        error.value = 'No GIFs found.'
      }
    } catch {
      // Also ignore errors from outdated responses
      if (myId !== requestId) return

      error.value = 'Failed to load GIFs.'
      next.value = null
    } finally {
      // Only clear loading if this is still the latest request
      if (myId === requestId) _clearLoading()
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
    fetchGifs
  }
})
