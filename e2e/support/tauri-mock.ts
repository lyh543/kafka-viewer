import type { Page } from '@playwright/test';

export type TauriInvokeCall = {
  cmd: string;
  args: Record<string, unknown>;
};

export type RecentProjectFixture = {
  name: string;
  path: string;
  last_opened: string;
};

export type TauriMockOptions = {
  /** Fake home directory returned by `homeDir()` from `@tauri-apps/api/path`. */
  home: string;
  recentProjects?: RecentProjectFixture[];
  connections?: unknown[];
};

/**
 * Installs a minimal `window.__TAURI_INTERNALS__` shim before any page script runs.
 *
 * The frontend only talks to the Rust side through `invoke`, so mocking this
 * single entry point is enough to drive the whole UI in a regular browser.
 * Every invoke call is recorded on `window.__TAURI_E2E__.calls` so tests can
 * assert on the IPC payloads.
 */
export async function installTauriMock(page: Page, options: TauriMockOptions): Promise<void> {
  await page.addInitScript(
    (mockOptions) => {
      const calls: TauriInvokeCall[] = [];
      const callbacks = new Map<number, (payload: unknown) => void>();
      let nextCallbackId = 1;

      const internals = {
        metadata: {
          currentWindow: { label: 'main' },
          currentWebview: { windowLabel: 'main', label: 'main' },
        },
        transformCallback(callback: (payload: unknown) => void) {
          const id = nextCallbackId;
          nextCallbackId += 1;
          callbacks.set(id, callback);
          return id;
        },
        unregisterCallback(id: number) {
          callbacks.delete(id);
        },
        convertFileSrc(filePath: string) {
          return filePath;
        },
        async invoke(cmd: string, args: Record<string, unknown> = {}) {
          calls.push({ cmd, args });

          switch (cmd) {
            case 'plugin:path|resolve_directory':
              // `BaseDirectory.Home` is 21 in the @tauri-apps/api path enum.
              return args.directory === 21
                ? mockOptions.home
                : `${mockOptions.home}/${String(args.directory)}`;
            case 'get_recent_projects':
              return mockOptions.recentProjects;
            case 'create_project':
              return { name: args.name, path: args.path };
            case 'open_project':
              return {
                name: String(args.path ?? '').split('/').filter(Boolean).pop() ?? '',
                path: args.path,
              };
            case 'get_connections':
              return mockOptions.connections;
            default:
              // close_project / remove_recent_project / log_frontend /
              // plugin:window|set_title and anything not modelled yet.
              return null;
          }
        },
      };

      const target = window as unknown as {
        __TAURI_INTERNALS__?: typeof internals;
        __TAURI_E2E__?: { calls: TauriInvokeCall[] };
      };

      target.__TAURI_INTERNALS__ = internals;
      target.__TAURI_E2E__ = { calls };
    },
    {
      home: options.home,
      recentProjects: options.recentProjects ?? [],
      connections: options.connections ?? [],
    }
  );
}

/** Returns every `invoke` call recorded since the page was loaded. */
export function getInvokeCalls(page: Page): Promise<TauriInvokeCall[]> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __TAURI_E2E__: { calls: TauriInvokeCall[] };
        }
      ).__TAURI_E2E__.calls
  );
}
