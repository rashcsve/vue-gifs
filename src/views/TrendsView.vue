<script setup lang="ts">
import { onMounted } from 'vue'
import { usePaginatedGifs } from '@/composables/usePaginatedGifs'
import GifList from '@/components/GifList.vue'

// STATE (cancelled automatically when the view unmounts)
const { gifs, isLoading, isLoadingMore, hasMore, error, isEmpty, load, loadMore, retry } =
  usePaginatedGifs('trends')

onMounted(() => void load())
</script>

<template>
  <h1 class="text-3xl font-semibold mb-4 text-center lg:text-left">Trending GIFs</h1>

  <div class="sr-only" aria-live="polite">
    <span v-if="isLoading || isLoadingMore">Loading…</span>
    <span v-else-if="error">{{ error }}</span>
  </div>

  <p v-if="error" class="mb-3 text-red-600">
    {{ error }}
    <button class="underline ml-2" :disabled="isLoading || isLoadingMore" @click="retry">
      Try again
    </button>
  </p>

  <p v-else-if="isEmpty" class="opacity-70 mb-3">No trending GIFs right now. Please try again.</p>

  <GifList
    :gifs="gifs"
    :is-loading="isLoading"
    :is-loading-more="isLoadingMore"
    :has-more="hasMore"
    @load-more="loadMore"
  />
</template>
