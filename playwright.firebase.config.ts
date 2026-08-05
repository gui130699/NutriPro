import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4174'

export default defineConfig({
  testDir: './tests/e2e/firebase',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/firebase', open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    // Exercise the optimized production chunks. The previous dev-server run
    // could not detect invalid cross-chunk Firebase initialization.
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_FIREBASE_API_KEY: 'fake-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'nutripro-test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'nutripro-test',
      VITE_FIREBASE_STORAGE_BUCKET: 'nutripro-test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:nutriprotest',
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_E2E: 'false',
    },
  },
  projects: [{ name: 'chromium-firebase', use: { ...devices['Desktop Chrome'] } }],
})
