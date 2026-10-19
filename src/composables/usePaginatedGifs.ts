import { computed, onScopeDispose, ref, type Ref } from 'vue'
import { fetchGifsFromApi, type Category, type GifItem } from '@/services'

export interface PaginatedGifs {
  gifs: Readonly<Ref<GifItem[]>>
  /** First page pending */
  isLoading: Readonly<Ref<boolean>>
  /** Later page pending */
  isLoadingMore: Readonly<Ref<boolean>>
  hasMore: Readonly<Ref<boolean>>
  /** Real failures only; an empty result is `isEmpty` */
  error: Readonly<Ref<string | null>>
  /** The fetched first page had no results */
  isEmpty: Readonly<Ref<boolean>>
  /** Query of the last load() ('' when none) */
  query: Readonly<Ref<string>>
  load: (query?: string) => Promise<void>
  loadMore: () => Promise<void>
  retry: () => Promise<void>
  cancel: () => void
  reset: () => void
}

/**
 * Paginated GIF list for one category. Each call owns its state, so pages don't share it.
 * - Aborts superseded requests and ignores their late responses via requestId
 * - Cancels the in-flight request when the owning scope (e.g. component) is disposed
 */
export function usePaginatedGifs(category: Category): PaginatedGifs {
  // --- STATE ---
  const gifs = ref<GifItem[]>([])
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const error = ref<string | null>(null)
  const isEmpty = ref(false)
  const next = ref<string | null>(null) // Offset of the following page
  const query = ref('')

  // Which request failed last, so retry() can repeat it
  let failed: 'first' | 'more' | null = null
  // Tracks the latest request to avoid updating state from out-of-order responses
  let requestId = 0
  // Aborts the in-flight request when it is superseded or cancelled
  let controller: AbortController | null = null

  const hasMore = computed(() => Boolean(next.value))

  // --- ACTIONS ---

  /**
   * Abort the in-flight request and keep the loaded data.
   */
  function cancel() {
    controller?.abort()
    controller = null
    // Invalidate in-flight requests; resetting to 0 would let a new request reuse their ID
    requestId++
    isLoading.value = false
    isLoadingMore.value = false
  }

  /**
   * Abort the in-flight request and clear all state.
   */
  function reset() {
    cancel()
    gifs.value = []
    error.value = null
    isEmpty.value = false
    next.value = null
    failed = null
    query.value = ''
  }

  async function fetchPage(firstPage: boolean) {
    const myId = ++requestId
    controller?.abort()
    controller = new AbortController()

    isLoading.value = firstPage
    isLoadingMore.value = !firstPage
    error.value = null
    failed = null

    try {
      const result = await fetchGifsFromApi(
        { query: query.value || undefined, category, offset: firstPage ? null : next.value },
        { signal: controller.signal }
      )

      // Ignore outdated responses (if a newer request has been made)
      if (myId !== requestId) return

      if (!result.ok) {
        if (result.error.kind === 'aborted') return
        console.error('[gifs] fetch failed:', result.error)
        error.value = 'Failed to load GIFs.'
        failed = firstPage ? 'first' : 'more'
        return
      }

      const { results, next: nextOffset } = result.data
      gifs.value = firstPage ? results : [...gifs.value, ...results]
      next.value = nextOffset
      if (firstPage && results.length === 0) isEmpty.value = true
    } catch (err) {
      // Also ignore errors from outdated responses
      if (myId !== requestId) return

      console.error('[gifs] fetch threw:', err)
      error.value = 'Failed to load GIFs.'
      failed = firstPage ? 'first' : 'more'
    } finally {
      // Only clear loading if this is still the latest request
      if (myId === requestId) {
        isLoading.value = false
        isLoadingMore.value = false
        controller = null
      }
    }
  }

  /**
   * Start over: clear state and fetch the first page for `q`.
   */
  function load(q?: string) {
    reset()
    query.value = q ?? ''
    return fetchPage(true)
  }

  /**
   * Fetch the following page. No-op while loading or when there is nothing more.
   */
  async function loadMore() {
    if (isLoading.value || isLoadingMore.value || !hasMore.value) return
    return fetchPage(false)
  }

  /**
   * Repeat the last failed request. No-op when nothing failed.
   */
  async function retry() {
    if (failed === 'first') return load(query.value)
    if (failed === 'more') return loadMore()
  }

  onScopeDispose(cancel)

  return {
    gifs,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    isEmpty,
    query,
    load,
    loadMore,
    retry,
    cancel,
    reset
  }
}
