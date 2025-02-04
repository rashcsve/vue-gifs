<script setup>
import { ref, onMounted } from "vue";
const props = defineProps(["gif", "observer"]);

const root = ref(null);

onMounted(() => {
  if (props.observer) props.observer.observe(root.value);
});
</script>

<template>
  <div
    ref="root"
    class="gif"
    :style="`background-image: url('${gif.media[0].gif.url}')`"
  ></div>
</template>

<style scoped>
.gif {
  width: 200px;
  height: 200px;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
}

@media screen and (min-width: 756px) {
  .gif {
    width: 250px;
    height: 250px;
  }
}
</style>
