import { expect, test } from '@playwright/test'
import { gifTitle, mockGifsApi, PAGE_SIZE } from './mocks'

// Short viewport, so the first page doesn't fill it and trigger load-more on its own
test.use({ viewport: { width: 800, height: 500 } })

test.describe('Trending page', () => {
  test('shows the first page of trending GIFs with alt text', async ({ page }) => {
    const api = await mockGifsApi(page)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Trending GIFs' })).toBeVisible()
    const images = page.getByRole('main').getByRole('img')
    await expect(images).toHaveCount(PAGE_SIZE)
    await expect(images.first()).toHaveAttribute('alt', gifTitle('trending', null, 1))
    await expect(images.last()).toHaveAttribute('alt', gifTitle('trending', null, PAGE_SIZE))

    expect(api.requests).toEqual([{ endpoint: 'trending', q: null, offset: 0 }])
  })

  test('shows an error with Try again when loading fails, and retry loads the GIFs', async ({
    page
  }) => {
    const api = await mockGifsApi(page, { failOnce: (req) => req.offset === 0 })
    await page.goto('/')

    const error = page.locator('p', { hasText: 'Failed to load GIFs.' })
    await expect(error).toBeVisible()
    await expect(page.getByRole('main').getByRole('img')).toHaveCount(0)

    await page.getByRole('button', { name: 'Try again' }).click()

    await expect(page.getByRole('main').getByRole('img')).toHaveCount(PAGE_SIZE)
    await expect(error).toBeHidden()
    expect(api.requests).toHaveLength(2)
  })

  test('shows a message when there are no trending GIFs', async ({ page }) => {
    await mockGifsApi(page, { totalCount: 0 })
    await page.goto('/')

    await expect(
      page.locator('p', { hasText: 'No trending GIFs right now. Please try again.' })
    ).toBeVisible()
    await expect(page.getByRole('main').getByRole('img')).toHaveCount(0)
  })
})
