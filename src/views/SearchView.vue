<script setup>
import { ref } from "vue";
import { useGifsStore } from "@/store/index";
import GifList from "@/components/GifList.vue";

const gifStore = useGifsStore();
gifStore.$reset();

const searchQuery = ref("");
const timeout = ref(null);

const handleSearchInput = () => {
  clearTimeout(timeout.value);
  gifStore.setOffset(null);
  timeout.value = setTimeout(fetchGifs, 1000);
};

const fetchGifs = async () => {
  await gifStore.fetchGifs({ query: searchQuery.value, category: "search" });
};
</script>

<template>
  <h1>Search GIFs</h1>
  <div class="input-wrapper">
    <input
      type="text"
      placeholder="Search gifs.."
      v-model="searchQuery"
      @input="handleSearchInput"
    />
  </div>
  <GifList @fetchGifs="fetchGifs" />
</template>

<style scoped>
.input-wrapper {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
}
@media (min-width: 1024px) {
  .input-wrapper {
    justify-content: flex-start;
  }
}
</style>
