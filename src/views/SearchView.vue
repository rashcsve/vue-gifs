<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useGifsStore } from '@/store'
import GifList from '@/components/GifList.vue'

// STORE
const gifStore = useGifsStore()
const { gifs, isLoading, isLoadingMore, error } = storeToRefs(gifStore)

// REFS
const searchQuery = ref<string>('')
const lastQueried = ref<string>('') // remembers the last query we fetched
let debounceId: number | undefined
const inputEl = ref<HTMLInputElement | null>(null)

// METHODS
const handleSearchInput = () => {
  if (debounceId) window.clearTimeout(debounceId)

  debounceId = window.setTimeout(() => {
    void fetchGifs()
  }, 500)
}

/**
 * Fetch search results for the current query.
 * - If query changed since last fetch → reset store for a clean first page
 * - Uses store's pagination for subsequent "Load more" calls
 * - Guard against concurrent requests
 */
const fetchGifs = async () => {
  const q = searchQuery.value.trim()

  // If query string changed, clear previous results and pagination
  if (q !== lastQueried.value) {
    gifStore.$reset()
    lastQueried.value = q
  }

  // Avoid overlapping requests
  if (isLoading.value || isLoadingMore.value) return

  try {
    await gifStore.fetchGifs({ query: q, category: 'search' })
  } catch (e) {
    console.error('[fetchGifs(search)]', e)
  }
}

/**
 * - Enter triggers search immediately (skips debounce)
 * - Escape clears the input and results
 */
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    if (debounceId) window.clearTimeout(debounceId)
    void fetchGifs()
  } else if (e.key === 'Escape') {
    searchQuery.value = ''
    gifStore.$reset()
    lastQueried.value = ''
  }
}

// Focus input on mount and start from a clean slate
onMounted(() => {
  gifStore.$reset()
  inputEl.value?.focus()
})
</script>

<template>
  <h1 class="text-2xl font-semibold mb-4">Search GIFs</h1>

  <div class="input-wrapper">
    <input
      ref="inputEl"
      type="text"
      class="border rounded px-3 py-2 w-full max-w-md"
      placeholder="Search GIFs…"
      v-model="searchQuery"
      @input="handleSearchInput"
      @keydown="onKeydown"
      autocomplete="off"
      spellcheck="false"
      aria-label="Search GIFs"
    />
  </div>

  <div class="sr-only" aria-live="polite">
    <span v-if="isLoading || isLoadingMore">Loading…</span>
    <span v-else-if="error">{{ error }}</span>
    <span v-else-if="!isLoading && !isLoadingMore && gifs.length === 0 && !!searchQuery">
      No results for "{{ searchQuery }}"
    </span>
  </div>

  <p v-if="error" class="mt-3 text-red-600">
    {{ error }}
    <button
      class="underline ml-2"
      :disabled="isLoading || isLoadingMore"
      @click="fetchGifs"
    >
      Try again
    </button>
  </p>

  <p
    v-else-if="!isLoading && !isLoadingMore && gifs.length === 0 && !!searchQuery"
    class="mt-3 opacity-70"
  >
    No results for “{{ searchQuery }}”. Try a different keyword.
  </p>

  <GifList class="mt-4" @fetchGifs="fetchGifs" />
</template>