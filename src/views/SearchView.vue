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

<script>
import { mapActions, mapMutations } from "vuex";
import GifList from "../components/GifList.vue";

export default {
  components: { GifList },
  data() {
    return { searchValue: "", timeout: null };
  },
  async created() {
    this.resetGifs();
  },
  methods: {
    ...mapMutations(["resetGifs"]),
    ...mapActions(["getGifsFromAPI"]),
    onSearch() {
      clearTimeout(this.timeout);
      this.timeout = setTimeout(() => {
        this.search();
      }, 200);
    },
    search() {
      this.getGifsFromAPI({ name: "search", value: this.searchValue });
    },
  },
};
</script>
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
