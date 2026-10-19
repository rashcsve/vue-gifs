<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebounce } from '@/composables/useDebounce'
import { usePaginatedGifs } from '@/composables/usePaginatedGifs'
import { RouteName } from '@/router/names'
import GifList from '@/components/GifList.vue'

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
  <h1 class="text-2xl font-semibold mb-4">Search GIFs</h1>

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

  <div class="sr-only" aria-live="polite">
    <span v-if="isLoading || isLoadingMore">Loading…</span>
    <span v-else-if="error">{{ error }}</span>
    <span v-else-if="isEmpty">No results for "{{ query }}"</span>
  </div>

  <p v-if="error" class="mt-3 text-red-600">
    {{ error }}
    <button class="underline ml-2" :disabled="isLoading || isLoadingMore" @click="retry">
      Try again
    </button>
  </p>

  <p v-else-if="isEmpty" class="mt-3 opacity-70">
    No results for “{{ query }}”. Try a different keyword.
  </p>

  <GifList
    class="mt-4"
    :gifs="gifs"
    :is-loading="isLoading"
    :is-loading-more="isLoadingMore"
    :has-more="hasMore"
    :paused="!!error"
    @load-more="loadMore"
  />
</template>
