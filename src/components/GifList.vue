<script setup>
import { ref, computed, onBeforeUnmount } from "vue";
import Gif from "@/components/GifItem.vue";
import { useGifsStore } from "@/store/index";

const emit = defineEmits(["getGifs"]);
const gifStore = useGifsStore();

const observer = ref(null);
observer.value = new IntersectionObserver(onElementObserved, {
  threshold: 1.0,
});

const gifs = computed(() => gifStore.getGifs);
const loading = computed(() => gifStore.getLoading);
const error = computed(() => gifStore.getError);

function isLastChild(index) {
  return index === this.gifs.length - 1;
}

function onElementObserved(entries) {
  entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) {
      return;
    }
    observer.value.unobserve(target);
    emit("getGifs");
  });
}
onBeforeUnmount(() => observer.value.disconnect());
</script>

<template>
  <p v-if="loading" class="loading">Loading...</p>
  <section v-else class="gif-list" ref="gifList">
    <div v-for="(gif, i) in gifs" :key="i">
      <Gif v-if="isLastChild(i)" :gif="gif" :observer="observer" />
      <Gif v-else :gif="gif" />
    </div>
    <p v-if="error" ref="error">No such GIFs found...</p>
  </section>
</template>

<style scoped>
.gif-list {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
}

.loading {
  text-align: center;
  margin-top: 1rem;
}

@media screen and (min-width: 756px) {
  .gif-list {
    justify-content: space-between;
  }
}
</style>
