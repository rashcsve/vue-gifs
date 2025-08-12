<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps(['gif', 'observer'])
const root = ref(null)

onMounted(() => {
  if (props.observer) props.observer.observe(root.value)
})
</script>

<template>
  <div
    ref="root"
    class="w-[180px] h-[180px] mb-2 md:mb-5 flex justify-center items-end bg-no-repeat bg-cover bg-center md:w-[200px] md:h-[200px]"
    :style="`background-image: url('${gif.media[0].gif.url}')`"
  ></div>
</template>
