<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebounce } from '@/composables/useDebounce'
import { usePaginatedGifs } from '@/composables/usePaginatedGifs'
import { RouteName } from '@/router/names'
import GifList from '@/components/GifList.vue'
import GifStatus from '@/components/GifStatus.vue'
import LoadError from '@/components/LoadError.vue'

// STATE (cancelled automatically when the view unmounts)
const {
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
  reset
} = usePaginatedGifs('search')

const route = useRoute()
const router = useRouter()

// REFS
const searchQuery = ref<string>('')
const inputEl = ref<HTMLInputElement | null>(null)
const headingEl = ref<HTMLElement | null>(null)
const listRef = ref<InstanceType<typeof GifList> | null>(null)

// Trimmed ?q= ('' when absent); null once the route has left this page
const routeQuery = computed<string | null>(() => {
  if (route.name !== RouteName.Search) return null
  const q = route.query.q
  return ((Array.isArray(q) ? q[0] : q) ?? '').trim()
})

// METHODS

/**
 * Search for the current input by writing it to ?q= (the watcher below fetches).
 * - Uses replace, so searches don't add history entries
 * - An empty input removes ?q=, which clears the results instead of calling the API
 * - The same query is not fetched again; if its last request failed, that request is retried
 */
const search = () => {
  const q = searchQuery.value.trim()

  if (q === routeQuery.value) {
    if (q && error.value) void retry()
    return
  }

  void router.replace({ query: q ? { q } : {} })
}

const debounce = useDebounce(search, 500)

/**
 * Retry, moving focus first: the retry removes the focused "Try again" button,
 * which would drop focus to <body>. A load-more error focuses the list, a first-page error the heading.
 */
const onRetry = () => {
  if (gifs.value.length) listRef.value?.focus()
  else headingEl.value?.focus()
  void retry()
}

/**
 * - Enter triggers search immediately (skips debounce)
 * - Escape cancels the pending search and clears the input, results and ?q=
 */
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    debounce.cancel()
    search()
  } else if (e.key === 'Escape') {
    debounce.cancel()
    searchQuery.value = ''
    reset()
    void router.replace({ query: {} })
  }
}

// ?q= is the source of truth: load it on mount and whenever it changes (our replace, nav link, history)
watch(
  routeQuery,
  (q) => {
    // A navigation (including leaving this page) supersedes text still waiting for the debounce
    debounce.cancel()
    if (q === null) return

    if (searchQuery.value.trim() !== q) searchQuery.value = q
    if (q === query.value) return

    if (q) void load(q)
    else reset()
  },
  { immediate: true }
)

onMounted(() => {
  inputEl.value?.focus()
})
</script>

<template>
  <h1 ref="headingEl" tabindex="-1" class="text-2xl font-semibold mb-4 outline-none">
    Search GIFs
  </h1>

  <div class="input-wrapper">
    <input
      ref="inputEl"
      v-model="searchQuery"
      type="text"
      class="border rounded px-3 py-2 w-full max-w-md"
      placeholder="Search GIFs…"
      autocomplete="off"
      spellcheck="false"
      aria-label="Search GIFs"
      @input="debounce.run()"
      @keydown="onKeydown"
    />
  </div>

  <GifStatus
    :is-loading="isLoading"
    :is-loading-more="isLoadingMore"
    :error="error"
    :is-empty="isEmpty"
    :count="gifs.length"
    :empty-message="`No results for “${query}”`"
  />

  <!-- A first-page error shows above the list, a load-more error below it (next to where the user is) -->
  <LoadError
    v-if="error && !gifs.length"
    class="mt-3"
    :message="error"
    :busy="isLoading || isLoadingMore"
    @retry="onRetry"
  />

  <p v-else-if="isEmpty" class="mt-3 text-(--color-text-muted)">
    No results for “{{ query }}”. Try a different keyword.
  </p>

  <GifList
    ref="listRef"
    class="mt-4"
    :gifs="gifs"
    :is-loading="isLoading"
    :is-loading-more="isLoadingMore"
    :has-more="hasMore"
    :paused="!!error"
    @load-more="loadMore"
  />

  <LoadError
    v-if="error && gifs.length"
    class="mt-3 text-center"
    :message="error"
    :busy="isLoading || isLoadingMore"
    @retry="onRetry"
  />
</template>
