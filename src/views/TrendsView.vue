<script setup>
import { useGifsStore } from "@/store/index";
import GifList from "../components/GifList.vue";
const gifStore = useGifsStore();

gifStore.resetGifs();
getGifs();

async function getGifs() {
  await gifStore.getGifsFromAPI({ name: "trends" });
}
</script>

<template>
  <h1>Trending GIFs</h1>
  <GifList @getGifs="getGifs" />
</template>
