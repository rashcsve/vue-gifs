<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import Gif from '@/components/GifItem.vue'
import { useGifsStore } from '@/store'

// EMITS
const emit = defineEmits<{ (e: 'fetchGifs'): void }>()

// STORE
const gifStore = useGifsStore()
const { gifs, isLoading, isLoadingMore, error, hasMore } = storeToRefs(gifStore)

// REFS
const listEl = ref<HTMLElement | null>(null)
const observer = ref<IntersectionObserver | null>(null)

// METHODS
/**
 * Observer callback:
 * - When the observed sentinel item enters the viewport, unobserve it and ask parent to fetch more.
 * - Guard against concurrent requests and when there's no more data.
 */
const onElementObserved: IntersectionObserverCallback = (entries, io) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    io.unobserve(entry.target)

    if (isLoading.value || isLoadingMore.value || !hasMore.value) continue

    emit('fetchGifs')
  }
}

onMounted(() => {
  observer.value = new IntersectionObserver(onElementObserved, {
    root: null,
    rootMargin: '300px 0px 300px 0px',
    threshold: 0.1
  })
})

onBeforeUnmount(() => {
  observer.value?.disconnect()
  observer.value = null
})

const items = computed(() => gifs.value ?? [])
const isLastIndex = (i: number) => i === items.value.length - 1

const keyOf = (gif: unknown, idx: number) => (gif as { id?: string })?.id ?? idx
</script>

<template>
  <p v-if="error" class="mt-4 text-red-600 text-center">
    {{ error }}
  </p>

  <p v-else-if="isLoading" class="mt-4 text-center">Loading…</p>

  <section v-else ref="listEl" class="mt-4 flex flex-wrap justify-center md:justify-between">
    <div v-for="(gif, index) in items" :key="keyOf(gif, index)">
      <Gif :gif="gif" :observer="isLastIndex(index) && hasMore ? observer : null" />
    </div>

    <p v-if="isLoadingMore" class="w-full text-center opacity-70">Loading more…</p>
  </section>
</template>
