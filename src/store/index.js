import { createStore } from "vuex";
import { getApiData } from "../services/api";

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
    resetGifs(state) {
      state.offset = null;
      state.error = null;
      state.loading = false;
      state.gifs = [];
    },
  },
  actions: {
    async getGifsFromAPI({ commit, state }, { value, name }) {
      try {
        const offset = state.offset;
        if (!offset) commit("setLoading", true);

        const fetchResponse = await getApiData({ value, name, offset });
        const data = await fetchResponse?.json();

        commit("setOffset", data?.next);
        let gifs = data?.results;
        if (offset) gifs = [...state.gifs, ...gifs];

        if (gifs?.length > 0) {
          commit("setGifs", gifs);
          commit("setError", false);
        } else {
          commit("setGifs", []);
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
