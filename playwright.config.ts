/** Chromium behaviour and visual review checks for the WebGL developer surface. */
import { defineConfig } from '@playwright/test';

// Browser software GL and CPU simulation need a generous initial catalogue preparation timeout.
const TEST_TIMEOUT_MS = 90_000;
const EXPECT_TIMEOUT_MS = 30_000;
// One retry is the agreed browser gate policy; serial work avoids GPU contention.
const RETRIES = 1;
export default defineConfig({
  testDir: './tests/browser',
  outputDir: './output/playwright/results',
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  retries: RETRIES,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'corepack pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: TEST_TIMEOUT_MS,
  },
});
