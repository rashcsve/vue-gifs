// Central place for API constants and env
export const API_BASE = 'https://api.giphy.com/v1/gifs'
export const DEFAULT_LIMIT = 12
export const DEFAULT_LANG = 'cs'
export const DEFAULT_RATING = 'g'

// Get a free key at https://developers.giphy.com/dashboard/ and put it in .env.local
export const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY ?? ''
