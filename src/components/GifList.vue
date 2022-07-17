<template>
  <div v-if="loading">Loading...</div>
  <section v-else class="gif-list" ref="gifList">
    <div v-for="gif in gifs" :key="gif.id">
      <Gif :gif="gif" :observer="observer" />
    </div>
  </section>
</template>

<script>
import { mapGetters } from "vuex";
import Gif from "../components/GifItem.vue";

export default {
  components: { Gif },
  computed: {
    ...mapGetters({ gifs: "getGifs", loading: "getLoading" }),
  },
};
</script>
