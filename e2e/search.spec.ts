import { expect, test } from '@playwright/test'
import {
  expectRequestCountToStay,
  gifTitle,
  mockGifsApi,
  PAGE_SIZE,
  SETTLE_MS,
  type GifsApiMock
} from './mocks'

// Short viewport, so the first page doesn't fill it and trigger load-more on its own
test.use({ viewport: { width: 800, height: 500 } })

const searchRequests = (api: GifsApiMock) => api.requests.filter((r) => r.endpoint === 'search')

test.describe('Search page', () => {
  test('focuses the search input on load', async ({ page }) => {
    await mockGifsApi(page)
    await page.goto('/search')

    await expect(page.getByRole('textbox', { name: 'Search GIFs' })).toBeFocused()
  })

  test('debounces typing into one request and writes ?q=', async ({ page }) => {
    // Fixed clock, so the 500 ms debounce is driven by the test, not by wall time
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
    const api = await mockGifsApi(page)
    await page.goto('/search')
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))

    const input = page.getByRole('textbox', { name: 'Search GIFs' })
    await input.pressSequentially('ca')
    await page.clock.runFor(300)
    await input.pressSequentially('ts')
    await page.clock.runFor(300)
    // 600 ms since the first key, but only 300 ms since the last one
    await expectRequestCountToStay(page, api, 0, SETTLE_MS.network)
    await expect(page).not.toHaveURL(/[?&]q=/)

    await page.clock.runFor(200)

    await expect(page).toHaveURL(/\/search\?q=cats$/)
    const images = page.getByRole('main').getByRole('img')
    await expect(images).toHaveCount(PAGE_SIZE)
    await expect(images.first()).toHaveAttribute('alt', gifTitle('search', 'cats', 1))
    expect(searchRequests(api)).toEqual([{ endpoint: 'search', q: 'cats', offset: 0 }])
  })

  test('trims the query', async ({ page }) => {
    const api = await mockGifsApi(page)
    await page.goto('/search')

    await page.getByRole('textbox', { name: 'Search GIFs' }).fill('  cats  ')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/search\?q=cats$/)
    await expect(page.getByRole('main').getByRole('img')).toHaveCount(PAGE_SIZE)
    expect(searchRequests(api)).toEqual([{ endpoint: 'search', q: 'cats', offset: 0 }])
  })

  test('Enter searches immediately, without waiting for the debounce', async ({ page }) => {
    // Paused clock: the debounce timer can never fire, so results can only come from Enter
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
    const api = await mockGifsApi(page)
    await page.goto('/search')
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))

    const input = page.getByRole('textbox', { name: 'Search GIFs' })
    await input.fill('cats')
    await input.press('Enter')

    await expect(page).toHaveURL(/\/search\?q=cats$/)
    await expect(page.getByRole('main').getByRole('img')).toHaveCount(PAGE_SIZE)

    // The pending debounce was cancelled: letting it fire must not search again
    await page.clock.runFor(1000)
    await expectRequestCountToStay(page, api, 1, SETTLE_MS.network)
  })

  test('searching the same query again does not refetch', async ({ page }) => {
    const api = await mockGifsApi(page)
    await page.goto('/search')

    const input = page.getByRole('textbox', { name: 'Search GIFs' })
    await input.fill('cats')
    await input.press('Enter')
    await expect(page.getByRole('main').getByRole('img')).toHaveCount(PAGE_SIZE)

    await input.press('Enter')
    await input.fill('cats ')
    await input.press('Enter')

    await expect(page).toHaveURL(/\/search\?q=cats$/)
    await expectRequestCountToStay(page, api, 1, SETTLE_MS.debounce)
  })

  test('Escape clears the input, the results and ?q=', async ({ page }) => {
    await mockGifsApi(page)
    await page.goto('/search?q=cats')

    const input = page.getByRole('textbox', { name: 'Search GIFs' })
    const images = page.getByRole('main').getByRole('img')
    await expect(images).toHaveCount(PAGE_SIZE)

    await input.press('Escape')

    await expect(input).toHaveValue('')
    await expect(images).toHaveCount(0)
    await expect(page).toHaveURL(/\/search$/)
  })

  test('a deep link with ?q= fills the input and loads the results', async ({ page }) => {
    const api = await mockGifsApi(page)
    await page.goto('/search?q=dogs')

    await expect(page.getByRole('textbox', { name: 'Search GIFs' })).toHaveValue('dogs')
    const images = page.getByRole('main').getByRole('img')
    await expect(images).toHaveCount(PAGE_SIZE)
    await expect(images.first()).toHaveAttribute('alt', gifTitle('search', 'dogs', 1))
    expect(api.requests).toEqual([{ endpoint: 'search', q: 'dogs', offset: 0 }])
  })

  test('shows a message when nothing matches', async ({ page }) => {
    await mockGifsApi(page, { totalCount: 0 })
    await page.goto('/search')

    const input = page.getByRole('textbox', { name: 'Search GIFs' })
    await input.fill('qwertyzzz')
    await input.press('Enter')

    await expect(
      page.locator('p', { hasText: 'No results for “qwertyzzz”. Try a different keyword.' })
    ).toBeVisible()
    await expect(page.getByRole('main').getByRole('img')).toHaveCount(0)
    await expect(page.locator('p', { hasText: 'Failed to load GIFs.' })).toHaveCount(0)
  })

  test('going from a search back to Trending shows trending GIFs, not search results', async ({
    page
  }) => {
    await mockGifsApi(page)
    await page.goto('/search?q=dogs')
    const images = page.getByRole('main').getByRole('img')
    await expect(images.first()).toHaveAttribute('alt', gifTitle('search', 'dogs', 1))

    await page.getByRole('link', { name: 'Trending' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Trending GIFs' })).toBeVisible()
    await expect(images).toHaveCount(PAGE_SIZE)
    await expect(images.first()).toHaveAttribute('alt', gifTitle('trending', null, 1))
    await expect(page.getByRole('img', { name: /^dogs GIF/ })).toHaveCount(0)
  })
})
