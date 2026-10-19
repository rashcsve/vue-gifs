// Central place for API constants, shared by the client and the Netlify function.
// No import.meta.env here: netlify/functions/gifs/gifs.ts imports this file outside Vite.
export const API_BASE = 'https://api.giphy.com/v1/gifs'
export const DEFAULT_LIMIT = 12
export const DEFAULT_LANG = 'cs'
export const DEFAULT_RATING = 'g'

// The browser calls this proxy; the GIPHY key (GIPHY_API_KEY) lives only on the server
export const API_PROXY_PATH = '/api/gifs'
