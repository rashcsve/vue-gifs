<script setup>
import { useGifsStore } from "@/store/index";
import GifList from "@/components/GifList.vue";

const gifStore = useGifsStore();

gifStore.$reset();
fetchTrendingGifs();

async function fetchTrendingGifs() {
  await gifStore.fetchGifs({ category: "trends" });
}
</script>

<template>
  <h1>Trending GIFs</h1>
  <GifList @fetchGifs="fetchTrendingGifs" />
</template>
