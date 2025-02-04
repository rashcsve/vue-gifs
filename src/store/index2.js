import { defineStore } from "pinia";
import { getApiData } from "../services/api";

const useGifsStore = defineStore({
  state: {
    gifs: [],
    loading: false,
    error: false,
    offset: null,
  },
  getters: {
    getError: (state) => state.error,
    getLoading: (state) => state.loading,
    getGifs: (state) => state.gifs,
  },
  actions: {
    setGifs(state, data) {
      this.gifs = data;
    },
    setLoading(state, value) {
      this.loading = value;
    },
    setError(state, value) {
      this.error = value;
    },
    setOffset(state, value) {
      this.offset = value;
    },
    resetGifs() {
      this.offset = null;
      this.error = null;
      this.loading = false;
      this.gifs = [];
    },
    async getGifsFromAPI({ value, name }) {
      try {
        const offset = this.offset;
        if (!offset) this.setLoading(true);

        const fetchResponse = await getApiData({ value, name, offset });
        const data = await fetchResponse?.json();

        this.setOffset(data?.next);
        let gifs = data?.results;
        if (offset) gifs = [...this.gifs, ...gifs];

        if (gifs?.length > 0) {
          this.setGifs(gifs);
          this.setError(false);
        } else {
          this.setGifs([]);
          this.setError(true);
        }
        this.setLoading(false);
      } catch (e) {
        this.setError(true);
        this.setLoading(false);
        this.setOffset(null);
      }
    },
  },
});

