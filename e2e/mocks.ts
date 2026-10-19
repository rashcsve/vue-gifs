import { expect, type Page } from '@playwright/test'
import type { GiphyGif, GiphyResponse } from '../src/services/types'

/** Page size the GIPHY proxy uses (DEFAULT_LIMIT) */
export const PAGE_SIZE = 12

/** One request the app made to /api/gifs */
export interface RecordedRequest {
  endpoint: string
  q: string | null
  /** 0 for the first page (no ?offset=) */
  offset: number
}

export interface MockOptions {
  /** total_count per request (default 100); 0 gives an empty page */
  totalCount?: number | ((req: RecordedRequest) => number)
  /** Answer the first request that matches with a 500; later matching requests succeed */
  failOnce?: (req: RecordedRequest) => boolean
}

export interface GifsApiMock {
  /** Every /api/gifs request so far, in order */
  requests: RecordedRequest[]
}

// 1x1 transparent GIF, so <img> loads without leaving the machine
const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/**
 * Title of the n-th GIF (1-based) for a request: "Trending GIF 3" or "dogs GIF 3".
 * Tests use it as the expected alt text.
 */
export function gifTitle(endpoint: string, q: string | null, n: number): string {
  return endpoint === 'trending' ? `Trending GIF ${n}` : `${q ?? ''} GIF ${n}`
}

function makePage(req: RecordedRequest, totalCount: number): GiphyResponse {
  const count = Math.max(0, Math.min(PAGE_SIZE, totalCount - req.offset))
  const data: GiphyGif[] = Array.from({ length: count }, (_, i) => {
    const n = req.offset + i + 1
    const id = `${req.endpoint}-${req.q ?? ''}-${n}`
    return {
      id,
      title: gifTitle(req.endpoint, req.q, n),
      images: { fixed_height: { url: `https://media.test/${encodeURIComponent(id)}.gif` } }
    }
  })
  return {
    data,
    pagination: { offset: req.offset, count, total_count: totalCount },
    meta: { status: 200, msg: 'OK' }
  }
}

/**
 * Mock the GIPHY proxy and GIF images in the browser, and abort any other request that would
 * leave localhost. Call before page.goto().
 */
export async function mockGifsApi(page: Page, options: MockOptions = {}): Promise<GifsApiMock> {
  const requests: RecordedRequest[] = []
  let failed = false

  // Safety net: page routes below take precedence over this context route.
  // Matches only non-local URLs, so the app's own assets aren't routed through the test runner
  await page
    .context()
    .route(/^https?:\/\/(?!(localhost|127\.0\.0\.1)[:/])/, (route) => route.abort())

  await page.route('https://media.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL_GIF })
  )

  await page.route('**/api/gifs?**', (route) => {
    const params = new URL(route.request().url()).searchParams
    const req: RecordedRequest = {
      endpoint: params.get('endpoint') ?? '',
      q: params.get('q'),
      offset: Number(params.get('offset') ?? 0)
    }
    requests.push(req)

    if (!failed && options.failOnce?.(req)) {
      failed = true
      return route.fulfill({ status: 500, json: { message: 'Mocked failure' } })
    }

    const total = options.totalCount ?? 100
    const totalCount = typeof total === 'function' ? total(req) : total
    return route.fulfill({ status: 200, json: makePage(req, totalCount) })
  })

  return { requests }
}

/** Scroll to the bottom of the page, where the infinite-scroll sentinel sits */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
}

/** How long expectRequestCountToStay waits, by what could still (wrongly) fire a request */
export const SETTLE_MS = {
  /** A real-time 500 ms debounce */
  debounce: 700,
  /** An IntersectionObserver callback (a frame or two) and its fetch */
  observer: 200,
  /** Only the network hop: a paused page.clock already ran every due timer in runFor() */
  network: 100
} as const

/**
 * Assert that no further request arrives: give the app `settleMs` to (wrongly) fire one,
 * then check the recorded count. A negative can't be awaited, so this short settle is on purpose.
 */
export async function expectRequestCountToStay(
  page: Page,
  api: GifsApiMock,
  count: number,
  settleMs: number
): Promise<void> {
  await page.waitForTimeout(settleMs)
  expect(api.requests).toHaveLength(count)
}
