import { createStore } from "vuex";

const store = createStore({
  state() {
    return {
      gifs: [],
    };
  },
  mutations: {
    setGifs(state, data) {
      state.gifs = data;
    },
  },
});

export default store;
