const API_URL = "https://g.tenor.com/v1/";
const API_KEY = "LIVDSRZULELA";

const getTrendingGifs = (offset) => {
  if (offset) {
    return fetch(
      `${API_URL}trending?key=${API_KEY}&locale=cz_CS&limit=12&pos=${offset}`
    );
  }
  return fetch(`${API_URL}trending?key=${API_KEY}&locale=cz_CS&limit=12`);
};

export { getTrendingGifs };
