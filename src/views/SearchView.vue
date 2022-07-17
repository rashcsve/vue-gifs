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
  <GifList />
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
    this.setGifs([]);
  },
  methods: {
    ...mapMutations(["setGifs"]),
    ...mapActions({ searchGifs: "searchGifs" }),
    onSearch() {
      clearTimeout(this.timeout);
      this.timeout = setTimeout(() => {
        this.searchGifs(this.searchValue);
      }, 200);
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
</style>
