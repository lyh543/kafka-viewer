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

export type ConnectionFixture = {
  id: string;
  name: string;
  brokers: string;
  auth: { type: 'none' | 'sasl_plain' | 'sasl_scram_256' | 'sasl_scram_512' | 'ssl' };
  created_at: string;
  updated_at: string;
};

export type TestConnectionFixture = {
  success: boolean;
  message: string;
  ping_ms?: number;
  broker_count?: number;
  topic_count?: number;
  partition_count?: number;
  brokers?: Array<{ id: number; host: string; port: number }>;
};

export type TopicStatusFixture = {
  info: {
    name: string;
    partitions: number;
    replication_factor: number;
    configs: Record<string, string>;
  };
  partitions: Array<{
    partition: number;
    leader: number;
    replicas: number[];
    isr: number[];
    beginning_offset: number;
    end_offset: number;
  }>;
};

export type KafkaMessageFixture = {
  topic: string;
  partition: number;
  offset: number;
  key: string | null;
  value: string | null;
  headers: Record<string, string>;
  timestamp: number;
};

export type ConsumerGroupInfoFixture = {
  group_id: string;
  state: string;
  protocol_type: string;
  coordinator: number;
  members: Array<{
    member_id: string;
    client_id: string;
    host: string;
    assignments: Array<{ topic: string; partitions: number[] }>;
  }>;
  offsets: Array<{
    topic: string;
    partition: number;
    current_offset: number;
    log_end_offset: number;
    lag: number;
  }>;
};

const DEFAULT_TEST_RESULT: TestConnectionFixture = {
  success: true,
  message: '连接成功',
  ping_ms: 0,
  broker_count: 1,
  topic_count: 5,
  partition_count: 54,
  brokers: [{ id: 0, host: 'localhost', port: 9092 }],
};

export type TauriMockOptions = {
  /** Fake home directory returned by `homeDir()` from `@tauri-apps/api/path`. */
  home: string;
  recentProjects?: RecentProjectFixture[];
  connections?: ConnectionFixture[];
  testConnectionResult?: TestConnectionFixture;
  /** Topics returned by `list_topics` for every connection. */
  topics?: string[];
  /** Consumer groups returned by `list_consumer_groups` for every connection. */
  consumerGroups?: string[];
  /** Response for `get_topic_status`. */
  topicStatus?: TopicStatusFixture;
  /** Messages returned by `fetch_messages`. */
  messages?: KafkaMessageFixture[];
  /** Response for `get_consumer_group_status`. */
  consumerGroupStatus?: ConsumerGroupInfoFixture;
};

type MockInitOptions = {
  home: string;
  recentProjects: RecentProjectFixture[];
  connections: ConnectionFixture[];
  testConnectionResult: TestConnectionFixture;
  topics: string[];
  consumerGroups: string[];
  topicStatus?: TopicStatusFixture;
  messages: KafkaMessageFixture[];
  consumerGroupStatus?: ConsumerGroupInfoFixture;
};

/**
 * Installs a minimal `window.__TAURI_INTERNALS__` shim before any page script runs.
 *
 * The frontend only talks to the Rust side through `invoke`, so mocking this
 * single entry point is enough to drive the whole UI in a regular browser.
 * Every invoke call is recorded on `window.__TAURI_E2E__.calls` so tests can
 * assert on the IPC payloads. Connection commands are stateful: `save_connection`
 * and `delete_connection` update an in-memory list that `get_connections` returns.
 */
export async function installTauriMock(page: Page, options: TauriMockOptions): Promise<void> {
  await page.addInitScript(
    (mockOptions: MockInitOptions) => {
      const calls: TauriInvokeCall[] = [];
      const callbacks = new Map<number, (payload: unknown) => void>();
      const connections = [...mockOptions.connections];
      let nextCallbackId = 1;
      let nextEventId = 1;

      // Required by `_unlisten` inside @tauri-apps/api/event.
      (window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown })[
        '__TAURI_EVENT_PLUGIN_INTERNALS__'
      ] = { unregisterListener() {} };

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
              return connections;
            case 'save_connection': {
              const connection = args.connection as ConnectionFixture;
              const index = connections.findIndex((item) => item.id === connection.id);

              if (index >= 0) {
                connections[index] = connection;
              } else {
                connections.push(connection);
              }

              return connection;
            }
            case 'delete_connection': {
              const index = connections.findIndex((item) => item.id === args.id);

              if (index >= 0) {
                connections.splice(index, 1);
              }

              return null;
            }
            case 'test_connection':
              return mockOptions.testConnectionResult;
            case 'list_topics':
              return mockOptions.topics;
            case 'list_consumer_groups':
              return mockOptions.consumerGroups;
            case 'get_topic_status':
              return mockOptions.topicStatus;
            case 'fetch_messages':
              return mockOptions.messages;
            case 'produce_message':
              return null;
            case 'get_consumer_group_status':
              return mockOptions.consumerGroupStatus;
            case 'plugin:event|listen': {
              const eventId = nextEventId;
              nextEventId += 1;
              return eventId;
            }
            case 'plugin:event|unlisten':
            case 'plugin:event|emit':
              return null;
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
      testConnectionResult: options.testConnectionResult ?? DEFAULT_TEST_RESULT,
      topics: options.topics ?? [],
      consumerGroups: options.consumerGroups ?? [],
      topicStatus: options.topicStatus,
      messages: options.messages ?? [],
      consumerGroupStatus: options.consumerGroupStatus,
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
