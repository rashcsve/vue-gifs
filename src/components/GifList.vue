<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import Gif from '@/components/GifItem.vue'
import type { GifItem } from '@/services'

// PROPS
const props = defineProps<{
  gifs: GifItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  /** Stop loading more (e.g. after a failed request) until it turns false again */
  paused?: boolean
}>()

// EMITS
const emit = defineEmits<{ (e: 'loadMore'): void }>()

// REFS
const sentinel = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)
const observer = ref<IntersectionObserver | null>(null)

const canLoadMore = computed(
  () => props.hasMore && !props.isLoading && !props.isLoadingMore && !props.paused
)

// METHODS
/**
 * Observer callback: when the sentinel below the list enters the viewport, ask the parent
 * for the next page. The watcher below decides when the sentinel is observed.
 */
const onSentinelObserved: IntersectionObserverCallback = (entries) => {
  if (canLoadMore.value && entries.some((entry) => entry.isIntersecting)) emit('loadMore')
}

onMounted(() => {
  observer.value = new IntersectionObserver(onSentinelObserved, {
    root: null,
    rootMargin: '300px 0px 300px 0px',
    threshold: 0.1
  })
})

/**
 * Observe the sentinel whenever another page may load, and stop observing while loading,
 * paused or when there is nothing more. Re-observing reports a visible sentinel at once,
 * so a short page keeps loading until the viewport is filled.
 */
watch(
  [observer, sentinel, canLoadMore],
  ([io, el, can], [, prevEl]) => {
    if (!io) return
    if (prevEl && prevEl !== el) io.unobserve(prevEl)
    if (!el) return
    if (can) io.observe(el)
    else io.unobserve(el)
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  observer.value?.disconnect()
  observer.value = null
})

/**
 * Move keyboard focus to the list without scrolling (the user is already at the bottom).
 */
const focus = () => list.value?.focus({ preventScroll: true })

defineExpose({ focus })
</script>

<template>
  <p v-if="isLoading" class="mt-4 text-center">Loading…</p>

  <section v-else class="mt-4">
    <!-- role="list": Safari drops list semantics when list-style is none -->
    <!-- tabindex="-1": focus() can move here (e.g. after a retry); no ring, it's not interactive -->
    <ul
      ref="list"
      role="list"
      tabindex="-1"
      class="flex flex-wrap justify-center md:justify-between outline-none"
      :aria-busy="isLoadingMore"
    >
      <li v-for="gif in gifs" :key="gif.id">
        <Gif :gif="gif" />
      </li>
    </ul>

    <div ref="sentinel" class="w-full h-px" aria-hidden="true" />

    <p v-if="isLoadingMore" class="w-full text-center text-(--color-text-muted)">Loading more…</p>
  </section>
</template>
