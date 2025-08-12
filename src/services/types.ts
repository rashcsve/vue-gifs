export type Category = 'trends' | 'search'

export interface TenorMediaVariant {
  url: string
  preview?: string
  dims?: [number, number]
  size?: number
  duration?: number
}

export type TenorMediaEntry = Partial<{
  gif: TenorMediaVariant
  mediumgif: TenorMediaVariant
  tinygif: TenorMediaVariant
  nanogif: TenorMediaVariant
  mp4: TenorMediaVariant
  tinymp4: TenorMediaVariant
  nanomp4: TenorMediaVariant
  webm: TenorMediaVariant
  tinywebm: TenorMediaVariant
  nanowebm: TenorMediaVariant
  loopedmp4: TenorMediaVariant
  gifpreview: TenorMediaVariant
  mp4preview: TenorMediaVariant
  webmpreview: TenorMediaVariant
}>

export interface GifItem {
  id: string
  title: string
  url: string
  itemurl?: string
  content_description?: string
  content_rating?: string
  h1_title?: string
  bg_color?: string
  created?: number
  shares?: number
  tags?: string[]
  flags?: string[]
  source_id?: string
  hasaudio?: boolean
  hascaption?: boolean
  composite?: unknown | null
  media: TenorMediaEntry[]
}

export interface GifsResponse {
  results: GifItem[]
  next?: string
  locale?: string
  [k: string]: unknown
}
