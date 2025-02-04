<script setup>
import { ref, computed, onBeforeUnmount } from "vue";
import Gif from "@/components/GifItem.vue";
import { useGifsStore } from "@/store/index";

const emit = defineEmits(["fetchGifs"]);
const gifStore = useGifsStore();

const observer = ref(null);
observer.value = new IntersectionObserver(onElementObserved, {
  threshold: 1.0,
});

const gifList = computed(() => gifStore.gifs);
const isLoading = computed(() => gifStore.isLoading);
const hasError = computed(() => gifStore.hasError);

const isLastItem = (index) => {
  return index === gifList.value.length - 1;
};

function onElementObserved(entries) {
  entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) {
      return;
    }
    observer.value.unobserve(target);
    emit("fetchGifs");
  });
}

onBeforeUnmount(() => observer.value.disconnect());
</script>

<template>
  <p v-if="isLoading" class="loading">Loading...</p>
  <section v-else class="gif-list" ref="gifList">
    <div v-for="(gif, index) in gifList" :key="index">
      <Gif :gif="gif" :observer="isLastItem(index) ? observer : null" />
    </div>
    <p v-if="hasError" ref="error">No such GIFs found...</p>
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
