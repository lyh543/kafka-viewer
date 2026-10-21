import { env } from 'node:process';
import { defineConfig, devices } from '@playwright/test';

const PORT = 1420;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!env.CI,
  retries: env.CI ? 2 : 0,
  workers: env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1120, height: 760 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // tauri-driver has no macOS support, so the app is exercised in a browser
        // with the Tauri IPC layer mocked (see e2e/support/tauri-mock.ts).
        // Defaults to the locally installed Google Chrome because the bundled
        // Chromium download is not always reachable. Run
        // `pnpm exec playwright install chromium` and unset
        // PLAYWRIGHT_BROWSER_CHANNEL to use the bundled build.
        channel: env.PLAYWRIGHT_BROWSER_CHANNEL ?? 'chrome',
      },
    },
  ],
  webServer: {
    command: 'pnpm web:dev',
    url: baseURL,
    reuseExistingServer: !env.CI,
    timeout: 120_000,
  },
});
