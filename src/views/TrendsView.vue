<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usePaginatedGifs } from '@/composables/usePaginatedGifs'
import GifList from '@/components/GifList.vue'
import GifStatus from '@/components/GifStatus.vue'
import LoadError from '@/components/LoadError.vue'

const EMPTY_MESSAGE = 'No trending GIFs right now. Please try again.'

// STATE (cancelled automatically when the view unmounts)
const { gifs, isLoading, isLoadingMore, hasMore, error, isEmpty, load, loadMore, retry } =
  usePaginatedGifs('trends')

// REFS
const headingEl = ref<HTMLElement | null>(null)
const listRef = ref<InstanceType<typeof GifList> | null>(null)

/**
 * Retry, moving focus first: the retry removes the focused "Try again" button,
 * which would drop focus to <body>. A load-more error focuses the list, a first-page error the heading.
 */
const onRetry = () => {
  if (gifs.value.length) listRef.value?.focus()
  else headingEl.value?.focus()
  void retry()
}

onMounted(() => void load())
</script>

<template>
  <h1
    ref="headingEl"
    tabindex="-1"
    class="text-3xl font-semibold mb-4 text-center lg:text-left outline-none"
  >
    Trending GIFs
  </h1>

  <GifStatus
    :is-loading="isLoading"
    :is-loading-more="isLoadingMore"
    :error="error"
    :is-empty="isEmpty"
    :count="gifs.length"
    :empty-message="EMPTY_MESSAGE"
  />

  <!-- A first-page error shows above the list, a load-more error below it (next to where the user is) -->
  <LoadError
    v-if="error && !gifs.length"
    class="mb-3"
    :message="error"
    :busy="isLoading || isLoadingMore"
    @retry="onRetry"
  />

  <p v-else-if="isEmpty" class="text-(--color-text-muted) mb-3">{{ EMPTY_MESSAGE }}</p>

  <GifList
    ref="listRef"
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
