<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Gif from '@/components/GifItem.vue'
import type { GifItem } from '@/services'

// PROPS
const props = defineProps<{
  gifs: GifItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
}>()

// EMITS
const emit = defineEmits<{ (e: 'loadMore'): void }>()

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

    if (props.isLoading || props.isLoadingMore || !props.hasMore) continue

    emit('loadMore')
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

const isLastIndex = (i: number) => i === props.gifs.length - 1

const keyOf = (gif: unknown, idx: number) => (gif as { id?: string })?.id ?? idx
</script>

<template>
  <p v-if="isLoading" class="mt-4 text-center">Loading…</p>

  <section v-else ref="listEl" class="mt-4 flex flex-wrap justify-center md:justify-between">
    <div v-for="(gif, index) in gifs" :key="keyOf(gif, index)">
      <Gif :gif="gif" :observer="isLastIndex(index) && hasMore ? observer : null" />
    </div>

    <p v-if="isLoadingMore" class="w-full text-center opacity-70">Loading more…</p>
  </section>
</template>
