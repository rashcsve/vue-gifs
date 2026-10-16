export type Category = 'trends' | 'search'

/** Provider-neutral GIF used by the app */
export interface GifItem {
  id: string
  title: string
  url: string
}

/** Normalized page of results; `next` is the offset for the following page */
export interface GifsResponse {
  results: GifItem[]
  next: string | null
}

// --- Raw GIPHY API shapes (only the fields we use) ---

export interface GiphyImage {
  url: string
  width?: string
  height?: string
}

export interface GiphyGif {
  id: string
  title: string
  images: Partial<Record<'fixed_height' | 'downsized' | 'original', GiphyImage>>
}

export interface GiphyResponse {
  data: GiphyGif[]
  pagination: { total_count: number; count: number; offset: number }
  meta: { status: number; msg: string }
}
