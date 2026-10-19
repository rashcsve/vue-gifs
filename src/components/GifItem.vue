<script setup lang="ts">
import type { GifItem } from '@/services'

defineProps<{ gif: GifItem }>()
</script>

<template>
  <img
    :src="gif.url"
    :alt="gif.title || 'GIF'"
    :title="gif.title"
    loading="lazy"
    decoding="async"
    width="200"
    height="200"
    class="w-[180px] h-[180px] mb-2 md:mb-5 object-cover md:w-[200px] md:h-[200px]"
  />
</template>
