<template>
  <p v-if="loading" class="loading">Loading...</p>
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
<style scoped>
.gif-list {
  margin-top: 20px;
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
