<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from 'vue'
import { usePaginatedGifs } from '@/composables/usePaginatedGifs'
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

// REFS
const searchQuery = ref<string>('')
let debounceId: number | undefined
const inputEl = ref<HTMLInputElement | null>(null)

// METHODS
const handleSearchInput = () => {
  if (debounceId) window.clearTimeout(debounceId)

  debounceId = window.setTimeout(() => {
    search()
  }, 500)
}

/**
 * Start a new search for the current input.
 * - An empty input clears the results instead of calling the API
 * - The same query is not fetched again; if its last request failed, that request is retried
 */
const search = () => {
  const q = searchQuery.value.trim()

  if (!q) {
    reset()
    return
  }
  if (q === query.value) {
    if (error.value) void retry()
    return
  }

  void load(q)
}

/**
 * - Enter triggers search immediately (skips debounce)
 * - Escape clears the input and results
 */
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    if (debounceId) window.clearTimeout(debounceId)
    search()
  } else if (e.key === 'Escape') {
    searchQuery.value = ''
    reset()
  }
}

onMounted(() => {
  inputEl.value?.focus()
})

onBeforeUnmount(() => {
  if (debounceId) window.clearTimeout(debounceId)
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
      @input="handleSearchInput"
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
