import { expect, test } from '@playwright/test'
import {
  expectRequestCountToStay,
  mockGifsApi,
  PAGE_SIZE,
  scrollToBottom,
  SETTLE_MS
} from './mocks'

// Short viewport, so one page doesn't fill it: only scrolling to the bottom loads more
test.use({ viewport: { width: 800, height: 500 } })

test.describe('Infinite scroll', () => {
  test('scrolling to the bottom loads the next page', async ({ page }) => {
    const api = await mockGifsApi(page)
    await page.goto('/')
    const images = page.getByRole('main').getByRole('img')
    await expect(images).toHaveCount(PAGE_SIZE)

    await scrollToBottom(page)

    await expect(images).toHaveCount(PAGE_SIZE * 2)
    expect(api.requests.map((r) => r.offset)).toEqual([0, PAGE_SIZE])
  })

  test('scrolling loads more search results for the same query', async ({ page }) => {
    const api = await mockGifsApi(page)
    await page.goto('/search?q=cats')
    const images = page.getByRole('main').getByRole('img')
    await expect(images).toHaveCount(PAGE_SIZE)

    await scrollToBottom(page)

    await expect(images).toHaveCount(PAGE_SIZE * 2)
    expect(api.requests).toEqual([
      { endpoint: 'search', q: 'cats', offset: 0 },
      { endpoint: 'search', q: 'cats', offset: PAGE_SIZE }
    ])
  })

  test('stops requesting when there is no next page', async ({ page }) => {
    const api = await mockGifsApi(page, { totalCount: PAGE_SIZE * 2 })
    await page.goto('/')
    const images = page.getByRole('main').getByRole('img')
    await expect(images).toHaveCount(PAGE_SIZE)

    await scrollToBottom(page)
    await expect(images).toHaveCount(PAGE_SIZE * 2)

    await scrollToBottom(page)

    await expectRequestCountToStay(page, api, 2, SETTLE_MS.observer)
    await expect(images).toHaveCount(PAGE_SIZE * 2)
  })

  test('a failed load-more pauses scrolling until Try again', async ({ page }) => {
    const api = await mockGifsApi(page, { failOnce: (req) => req.offset === PAGE_SIZE })
    await page.goto('/')
    const images = page.getByRole('main').getByRole('img')
    await expect(images).toHaveCount(PAGE_SIZE)

    await scrollToBottom(page)

    await expect(page.locator('p', { hasText: 'Failed to load GIFs.' })).toBeVisible()
    await expect(images).toHaveCount(PAGE_SIZE)
    expect(api.requests).toHaveLength(2)

    // Scrolling away and back must not retry on its own
    await page.evaluate(() => window.scrollTo(0, 0))
    await scrollToBottom(page)
    await expectRequestCountToStay(page, api, 2, SETTLE_MS.observer)

    await page.getByRole('button', { name: 'Try again' }).click()

    await expect(images).toHaveCount(PAGE_SIZE * 2)
    await expect(page.locator('p', { hasText: 'Failed to load GIFs.' })).toHaveCount(0)
    expect(api.requests.map((r) => r.offset)).toEqual([0, PAGE_SIZE, PAGE_SIZE])
  })
})
