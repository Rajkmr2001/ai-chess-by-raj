import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build served from the GitHub
 * Pages sub-path, so asset-path regressions are caught before deployment.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/chess-ai-assistant/',
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --host 0.0.0.0',
    url: 'http://127.0.0.1:4173/chess-ai-assistant/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
