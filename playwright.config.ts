import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173'

/**
 * Smoke suite intentionally covers only client-side behavior that does not
 * require a Firebase account or make changes in the production project.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/firebase/**'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173',
        // Smoke tests deliberately have no real backend. Force this for local
        // runs too, so the default command can never initialize production Firebase.
        env: { ...process.env, VITE_E2E: 'true' },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
