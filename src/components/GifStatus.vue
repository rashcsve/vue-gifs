<script setup lang="ts">
import { computed, ref, watch } from 'vue'

// PROPS
const props = defineProps<{
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  isEmpty: boolean
  /** GIFs currently shown */
  count: number
  /** Announced when the fetched first page had no results */
  emptyMessage: string
}>()

// REFS
// "N GIFs loaded" for the latest finished load ('' when there is nothing new)
const loaded = ref('')
// GIFs shown when the current load-more started, to count what it added
let countBeforeMore = 0

const gifs = (n: number) => (n === 1 ? 'GIF' : 'GIFs')

/**
 * Track load transitions so a finished load is announced once:
 * - first page: "N GIFs loaded"
 * - later page: "N more GIFs loaded, M total" (nothing if it added none)
 */
watch(
  () => [props.isLoading, props.isLoadingMore] as const,
  ([loading, loadingMore], [wasLoading, wasLoadingMore]) => {
    if (loadingMore && !wasLoadingMore) countBeforeMore = props.count
    if (loading || loadingMore) {
      loaded.value = ''
      return
    }
    if (props.error) return

    const added = props.count - countBeforeMore
    if (wasLoading && props.count > 0) {
      loaded.value = `${props.count} ${gifs(props.count)} loaded`
    } else if (wasLoadingMore && added > 0) {
      loaded.value = `${added} more ${gifs(added)} loaded, ${props.count} total`
    }
  }
)

const message = computed(() => {
  if (props.isLoading) return 'Loading GIFs…'
  if (props.isLoadingMore) return 'Loading more GIFs…'
  if (props.error) return props.error
  if (props.isEmpty) return props.emptyMessage
  // Results cleared without a load (e.g. Escape) leave nothing to report
  return props.count > 0 ? loaded.value : ''
})
</script>

<template>
  <div class="sr-only" role="status" aria-live="polite">{{ message }}</div>
</template>
