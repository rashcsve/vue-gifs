const API_URL = "https://g.tenor.com/v1/";
const API_KEY = "LIVDSRZULELA";
const LIMIT = "limit=12";
const LOCALE = "locale=cs_CZ";

// Helper function to build the URL with the provided parameters
const buildUrl = (endpoint, params) => {
  let url = `${API_URL}${endpoint}?key=${API_KEY}&${LOCALE}&${LIMIT}`;

  // Add optional query and offset to the URL
  if (params.query) url += `&q=${encodeURIComponent(params.query)}`;
  if (params.offset) url += `&pos=${params.offset}`;

  return url;
};

// Function to fetch data from the API and handle response errors
const fetchData = async (url) => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    return { error: error.message }; // Return error message in case of failure
  }
};

// Generic fetch function for both trending and search GIFs
const fetchGifsData = async (endpoint, params) => {
  const url = buildUrl(endpoint, params);
  return await fetchData(url);
};

// General function to fetch data based on the category
const fetchGifsFromApi = async ({ category, query, offset }) => {
  switch (category) {
    case "trends":
      return await fetchGifsData("trending", { offset });
    case "search":
      return await fetchGifsData("search", { query, offset });
    default:
      return { error: "Invalid category specified" };
  }
};

export { fetchGifsFromApi };
