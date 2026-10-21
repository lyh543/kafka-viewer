# E2E tests

End-to-end tests run the real frontend in a browser through Playwright.

## Why not `tauri-driver`?

`tauri-driver` only supports Linux (WebKitWebDriver) and Windows (Edge WebDriver).
There is no macOS driver, so instead the tests load the Vite dev server and mock
the single seam that talks to Rust: `window.__TAURI_INTERNALS__.invoke`.

The mock lives in `support/tauri-mock.ts` and records every `invoke` call, so a
test can assert both on the rendered UI and on the exact IPC payloads.
Connection commands are stateful: `save_connection` / `delete_connection` mutate
an in-memory list returned by `get_connections`, so reopening the manager sees
the same data the backend would return. `test_connection` returns a canned
successful result (`success`, `ping_ms`, counts and broker nodes) that can be
overridden per test.

## Commands

```bash
pnpm test:e2e        # headless run
pnpm test:e2e:ui     # interactive UI mode
```

The `webServer` block in `playwright.config.ts` starts `pnpm web:dev`
(http://localhost:1420) automatically and reuses an already running dev server
outside CI.

## Browser

By default the locally installed Google Chrome is used (`channel: 'chrome'`)
because the bundled Chromium download is not always reachable. Override with
`PLAYWRIGHT_BROWSER_CHANNEL=<channel>`, or install the bundled build:

```bash
pnpm exec playwright install chromium
PLAYWRIGHT_BROWSER_CHANNEL= playwright test
```

## Writing a test

```ts
import { test, expect } from '@playwright/test';
import { installTauriMock } from './support/tauri-mock';

test.beforeEach(async ({ page }) => {
  await installTauriMock(page, { home: '/tmp/e2e-home' });
  await page.goto('/');
});
```

Extend the `switch` in `installTauriMock` when a test needs a command that is not
modelled yet.
