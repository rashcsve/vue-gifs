<template>
  <p v-if="loading" class="loading">Loading...</p>
  <section v-else class="gif-list" ref="gifList">
    <div v-for="(gif, i) in gifs" :key="i">
      <Gif v-if="isLastChild(i)" :gif="gif" :observer="observer" />
      <Gif v-else :gif="gif" />
    </div>
    <p v-if="error" ref="error">No such GIFs found...</p>
  </section>
</template>

<script>
import { mapGetters } from "vuex";
import Gif from "../components/GifItem.vue";

export default {
  components: { Gif },
  data() {
    return { observer: null };
  },
  created() {
    this.observer = new IntersectionObserver(this.onElementObserved, {
      root: this.$el,
      threshold: 1.0,
    });
  },
  computed: {
    ...mapGetters({
      gifs: "getGifs",
      loading: "getLoading",
      error: "getError",
    }),
  },
  methods: {
    isLastChild(index) {
      return index === this.gifs.length - 1;
    },
    onElementObserved(entries) {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) {
          return;
        }
        this.observer.unobserve(target);
        this.$emit("getGifs");
      });
    },
  },
  beforeUnmount() {
    this.observer.disconnect();
  },
};
</script>
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
