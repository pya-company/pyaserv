import { defineConfig, devices } from '@playwright/test'

// Tests run against a real deployment by default (PROD). Set PYASERV_E2E_BASE
// to point at a preview URL or a local astro preview server when iterating.
const BASE = process.env.PYASERV_E2E_BASE ?? 'https://pyaserv.com'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // Filename suffix carries the viewport scope. mobile-chrome runs files
      // ending in .mobile.spec.ts or .common.spec.ts; desktop-chrome runs
      // .desktop.spec.ts or .common.spec.ts. No skips at runtime — each
      // project owns its own viewport-appropriate tests.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: /.*\.(mobile|common)\.spec\.ts/,
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.(desktop|common)\.spec\.ts/,
    },
  ],
})
