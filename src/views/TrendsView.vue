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

<style scoped>
.gif-list {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
}

@media screen and (min-width: 1024px) {
  .gif-list {
    justify-content: space-between;
  }
}
</style>
