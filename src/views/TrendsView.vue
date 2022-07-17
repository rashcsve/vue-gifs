<template>
  <h1>Trending GIFs</h1>
  <GifList />
</template>

<script>
import { mapActions } from "vuex";
import GifList from "../components/GifList.vue";

export default {
  components: { GifList },
  async created() {
    await this.getGifs();
  },
  methods: {
    ...mapActions({ getGifs: "getTrendingGifsFromAPI" }),
  },
};
</script>
