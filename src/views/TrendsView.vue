<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useGifsStore } from '@/store'
import GifList from '@/components/GifList.vue'

// STORE
const gifStore = useGifsStore()

// REFS
const { gifs, isLoading, isLoadingMore, error } = storeToRefs(gifStore)

// METHODS
/**
 * Fetch trending GIFs (first page or "load more" depending on store.next).
 * - Guards against concurrent requests (first-page or load-more).
 * - Leaves user-facing messaging to the template via `error` string.
 */
const fetchTrendingGifs = async () => {
  if (isLoading.value || isLoadingMore.value) return

  try {
    await gifStore.fetchGifs({ category: 'trends' as const })
  } catch (e) {
    console.error('[fetchTrendingGifs]', e)
  }
}

onMounted(() => {
  gifStore.$reset()
  void fetchTrendingGifs()
})
</script>

<template>
  <h1 class="text-3xl font-semibold mb-4 text-center lg:text-left">Trending GIFs</h1>

  <div class="sr-only" aria-live="polite">
    <span v-if="isLoading || isLoadingMore">Loading…</span>
    <span v-else-if="error">{{ error }}</span>
  </div>

  <p v-if="error" class="mb-3 text-red-600">
    {{ error }}
    <button
      class="underline ml-2"
      :disabled="isLoading || isLoadingMore"
      @click="fetchTrendingGifs"
    >
      Try again
    </button>
  </p>

  <p v-else-if="!isLoading && !isLoadingMore && gifs.length === 0" class="opacity-70 mb-3">
    No trending GIFs right now. Please try again.
  </p>

  <GifList @fetchGifs="fetchTrendingGifs" />
</template>
