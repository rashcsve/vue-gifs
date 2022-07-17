<template>
  <h1>Trending GIFs</h1>
  <GifList @getGifs="getGifs" />
</template>

<script>
import { mapActions, mapMutations } from "vuex";
import GifList from "../components/GifList.vue";

export default {
  components: { GifList },
  async created() {
    this.resetGifs();
    await this.getGifs();
  },
  methods: {
    ...mapMutations(["resetGifs"]),
    ...mapActions(["getGifsFromAPI"]),
    async getGifs() {
      await this.getGifsFromAPI({ name: "trends" });
    },
  },
};
</script>
