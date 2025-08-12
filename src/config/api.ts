// Central place for API constants and env
export const API_BASE = 'https://g.tenor.com/v1'
export const DEFAULT_LIMIT = 12
export const DEFAULT_LOCALE = 'cs_CZ'

// Prefer env for real usage; fallback demo key keeps the app runnable
export const TENOR_API_KEY =
  import.meta.env.VITE_TENOR_API_KEY ?? 'LIVDSRZULELA'
