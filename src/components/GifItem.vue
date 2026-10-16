<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { GifItem } from "@/services";

const props = defineProps<{
  gif: GifItem;
  observer: IntersectionObserver | null;
}>();
const root = ref<HTMLElement | null>(null);

onMounted(() => {
  if (props.observer && root.value) props.observer.observe(root.value);
});
</script>

<template>
  <div
    ref="root"
    role="img"
    :aria-label="gif.title || 'GIF'"
    :title="gif.title"
    class="w-[180px] h-[180px] mb-2 md:mb-5 flex justify-center items-end bg-no-repeat bg-cover bg-center md:w-[200px] md:h-[200px]"
    :style="{ backgroundImage: `url('${gif.url}')` }"
  ></div>
</template>
