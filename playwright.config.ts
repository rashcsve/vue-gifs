import { defineConfig, devices } from '@playwright/test'

// Its own port, so it never clashes with `npm run dev` (5173) or the Docker preview (4173)
const PORT = 4174
const CI = !!process.env.CI
const OUT_DIR = 'dist-e2e'
// Direct binary, not npx: no package lookup before every run
const VITE = './node_modules/.bin/vite'
const PREVIEW = `${VITE} preview --outDir ${OUT_DIR} --port ${PORT} --strictPort`

/**
 * End-to-end tests against the production build (`vite preview`).
 * Specs mock /api/gifs in the browser, so no GIPHY key is needed and GIPHY is never called.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // The specs mostly wait on the browser, so more workers than half the CPUs pay off
  workers: CI ? 2 : '75%',
  forbidOnly: CI,
  // One retry records a trace; a test that only passes on retry still fails the run
  retries: CI ? 1 : 0,
  failOnFlakyTests: CI,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      // Playwright's headless shell by default (`npx playwright install chromium-headless-shell`);
      // PW_CHANNEL=chrome uses the installed Google Chrome instead, which starts slower
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL }
    }
  ],
  webServer: {
    // vite directly: skips vue-tsc, which `npm run verify` already runs.
    // Own outDir, so e2e runs never overwrite dist/. CI builds in its own step first
    command: CI ? PREVIEW : `${VITE} build --outDir ${OUT_DIR} && ${PREVIEW}`,
    url: `http://localhost:${PORT}`,
    // A server already on this port is reused locally; stop it after changing src/
    reuseExistingServer: !CI,
    timeout: 120_000,
    // An empty key beats .env.local (vite loadEnv), so a request a spec forgets to mock
    // gets a 500 from the proxy instead of reaching GIPHY with the real key
    env: { GIPHY_API_KEY: '' }
  }
})
