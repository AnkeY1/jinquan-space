import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
const chrome =
  process.env.CHROME_PATH ||
  (process.platform === 'win32' &&
  existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : undefined);
export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', 'accessibility/**/*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { ...(chrome ? { executablePath: chrome } : {}) },
      },
    },
  ],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: 'node scripts/e2e-server.mjs',
        url: 'http://127.0.0.1:4173',
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
      },
});
