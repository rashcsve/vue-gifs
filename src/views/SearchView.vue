<script setup>
import { ref } from "vue";

import { useGifsStore } from "@/store/index";
import GifList from "@/components/GifList.vue";
const gifStore = useGifsStore();

gifStore.resetGifs();

const searchValue = ref("");
const timeout = ref(null);

function onSearch() {
  console.log("here");
  clearTimeout(timeout.value);
  gifStore.setOffset(null);
  timeout.value = setTimeout(() => {
    search();
  }, 1000);
}

async function search() {
  await gifStore.getGifsFromAPI({ name: "search", value: searchValue.value });
}
</script>

<template>
  <h1>Search GIFs</h1>
  <div class="input-wrapper">
    <input
      type="text"
      placeholder="Search gifs.."
      v-model="searchValue"
      @input="onSearch"
    />
  </div>
  <GifList @getGifs="search" />
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
