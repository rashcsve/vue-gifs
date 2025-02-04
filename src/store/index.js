import { defineStore } from "pinia";
import { ref } from "vue";

import { fetchGifsFromApi } from "@/services/api";

export const useGifsStore = defineStore("gifStore", () => {
  const gifs = ref([]);
  const isLoading = ref(false);
  const hasError = ref(false);
  const _offset = ref(null);

  function $reset() {
    _offset.value = null;
    hasError.value = false;
    isLoading.value = false;
    gifs.value = [];
  }

  function _setGifs(data) {
    gifs.value = data;
  }

  function _setLoadingStatus(value) {
    isLoading.value = Boolean(value);
  }

  function _setErrorStatus(value) {
    hasError.value = Boolean(value);
  }

  function setOffset(value) {
    _offset.value = value;
  }

  async function fetchGifs({ query, category }) {
    try {
      if (!_offset.value) _setLoadingStatus(true);

      const data = await fetchGifsFromApi({
        query,
        category,
        offset: _offset.value,
      });

      if (!data) throw new Error("Failed to fetch data");

      setOffset(data.next);

      const result = data.results
        ? _offset.value
          ? [...gifs.value, ...data.results]
          : data.results
        : [];

      _setGifs(result);
      _setErrorStatus(result.length === 0);
    } catch (e) {
      _setErrorStatus(true);
      setOffset(null);
    } finally {
      _setLoadingStatus(false);
    }
  }

  return { gifs, isLoading, hasError, $reset, setOffset, fetchGifs };
});
