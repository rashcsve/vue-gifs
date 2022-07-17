import { createStore } from "vuex";
import { getTrendingGifs, searchGifs } from "../services/api";

const store = createStore({
  state() {
    return {
      gifs: [],
      loading: false,
      error: false,
      offset: null,
    };
  },
  getters: {
    getError: (state) => state.error,
    getLoading: (state) => state.loading,
    getGifs: (state) => state.gifs,
  },
  mutations: {
    setGifs(state, data) {
      state.gifs = data;
    },
    setLoading(state, value) {
      state.loading = value;
    },
    setError(state, value) {
      state.error = value;
    },
    setOffset(state, value) {
      state.offset = value;
    },
  },
  actions: {
    async getTrendingGifsFromAPI({ commit, state }) {
      try {
        commit("setLoading", true);
        const fetchResponse = await getTrendingGifs(state.offset);
        const data = await fetchResponse.json();
        commit("setOffset", data?.next);
        if (data?.results?.length > 0) {
          commit("setGifs", data?.results);
          commit("setError", false);
        } else {
          commit("setError", true);
        }
        commit("setLoading", false);
      } catch (e) {
        commit("setError", true);
        commit("setLoading", false);
        commit("setOffset", null);
      }
    },
    async searchGifs({ commit }, value) {
      try {
        commit("setLoading", true);
        const fetchResponse = await searchGifs(value);
        const data = await fetchResponse.json();
        commit("setOffset", null);
        if (data?.results?.length > 0) {
          commit("setGifs", data?.results);
          commit("setError", false);
        } else {
          commit("setError", true);
        }
        commit("setLoading", false);
      } catch (e) {
        commit("setError", true);
        commit("setLoading", false);
        commit("setOffset", null);
      }
    },
  },
});

export default store;
