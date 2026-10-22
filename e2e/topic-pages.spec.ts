import { expect, test, type Page } from '@playwright/test';
import {
  getInvokeCalls,
  installTauriMock,
  type ConnectionFixture,
  type ConsumerGroupInfoFixture,
  type KafkaMessageFixture,
  type TopicStatusFixture,
} from './support/tauri-mock';

const HOME = '/tmp/kafka-viewer-e2e-topic-home';

const CONNECTION: ConnectionFixture = {
  id: 'conn-1',
  name: '本地集群',
  brokers: 'localhost:9092',
  auth: { type: 'none' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const TOPIC_STATUS: TopicStatusFixture = {
  info: {
    name: 'orders',
    partitions: 2,
    replication_factor: 1,
    configs: {},
  },
  partitions: [
    { partition: 0, leader: 0, replicas: [0], isr: [0], beginning_offset: 0, end_offset: 41 },
    { partition: 1, leader: 0, replicas: [0], isr: [0], beginning_offset: 0, end_offset: 7 },
  ],
};

const MESSAGES: KafkaMessageFixture[] = [
  {
    topic: 'orders',
    partition: 0,
    offset: 41,
    key: 'order-1',
    value: '{"id":1}',
    headers: { trace: 'abc' },
    timestamp: 1760000000000,
  },
  {
    topic: 'orders',
    partition: 1,
    offset: 7,
    key: null,
    value: 'plain text',
    headers: {},
    timestamp: 1760000001000,
  },
];

const CONSUMER_GROUP: ConsumerGroupInfoFixture = {
  group_id: 'group-a',
  state: 'Stable',
  protocol_type: 'consumer',
  coordinator: 0,
  members: [
    {
      member_id: 'member-1',
      client_id: 'client-1',
      host: '/127.0.0.1',
      assignments: [{ topic: 'orders', partitions: [0, 1] }],
    },
  ],
  offsets: [
    { topic: 'orders', partition: 0, current_offset: 40, log_end_offset: 42, lag: 2 },
    { topic: 'orders', partition: 1, current_offset: 0, log_end_offset: 1500, lag: 1500 },
  ],
};

async function enterWorkspace(page: Page) {
  await page.getByRole('button', { name: /新建项目/ }).first().click();
  const dialog = page.getByRole('dialog', { name: '新建项目' });
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installTauriMock(page, {
    home: HOME,
    connections: [CONNECTION],
    topics: ['orders'],
    consumerGroups: ['group-a'],
    topicStatus: TOPIC_STATUS,
    messages: MESSAGES,
    consumerGroupStatus: CONSUMER_GROUP,
  });

  await page.goto('/');
  await enterWorkspace(page);
});

test.describe('主题页面', () => {
  test('单击主题打开状态页并渲染分区表', async ({ page }) => {
    await page.getByRole('button', { name: '主题' }).click();
    const topicLeaf = page.getByRole('button', { name: 'orders' });
    await expect(topicLeaf).toBeVisible();

    // Group headings keep normal weight; only leaf names are light.
    await expect(page.getByRole('button', { name: '主题' })).toHaveCSS('font-weight', '400');
    await expect(page.getByRole('button', { name: '消费者组' })).toHaveCSS('font-weight', '400');

    await topicLeaf.click();

    await expect(page.getByRole('heading', { name: 'orders' })).toBeVisible();
    await expect(page.getByRole('button', { name: /orders - 状态/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Leader' })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(2);

    const statusCall = (await getInvokeCalls(page)).find((call) => call.cmd === 'get_topic_status');
    expect(statusCall?.args).toMatchObject({ connectionId: 'conn-1', topic: 'orders' });
  });

  test('开启自动刷新后出现间隔选择器', async ({ page }) => {
    await page.getByRole('button', { name: '主题' }).click();
    await page.getByRole('button', { name: 'orders' }).click();
    await expect(page.getByRole('heading', { name: 'orders' })).toBeVisible();

    const autoRefreshSwitch = page.getByRole('switch');
    await expect(autoRefreshSwitch).toHaveAttribute('data-state', 'unchecked');
    await autoRefreshSwitch.click();
    await expect(autoRefreshSwitch).toHaveAttribute('data-state', 'checked');
    await expect(page.locator('select')).toHaveCount(1);
  });

  test('切换到数据页后可以展开消息详情并写入消息', async ({ page }) => {
    await page.getByRole('button', { name: '主题' }).click();
    await page.getByRole('button', { name: 'orders' }).click();
    await expect(page.getByRole('heading', { name: 'orders' })).toBeVisible();

    await page.getByRole('button', { name: '查看数据' }).click();

    await expect(page.getByRole('button', { name: /orders - 数据/ })).toBeVisible();
    await expect(page.getByText('2 条消息')).toBeVisible();

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('order-1');

    await page.getByRole('button', { name: '展开详情' }).first().click();
    await expect(page.getByText('Headers')).toBeVisible();
    await expect(page.getByText('trace')).toBeVisible();

    const fetchCall = (await getInvokeCalls(page)).find((call) => call.cmd === 'fetch_messages');
    expect(fetchCall?.args).toMatchObject({
      connectionId: 'conn-1',
      topic: 'orders',
      filter: { start_from: { type: 'last_n', count: 100 } },
    });

    await page.getByRole('button', { name: '写入数据' }).click();
    const produceDialog = page.getByRole('dialog');
    await expect(produceDialog).toBeVisible();

    await produceDialog.getByLabel('Value').fill('hello kafka');
    await produceDialog.getByLabel('Key').fill('order-2');
    await produceDialog.getByLabel('Headers (JSON)').fill('{"trace":"xyz"}');
    await produceDialog.getByRole('button', { name: '发送' }).click();

    await expect(page.getByText('消息已发送')).toBeVisible();
    await expect(produceDialog).toBeHidden();

    const produceCall = (await getInvokeCalls(page)).find((call) => call.cmd === 'produce_message');
    expect(produceCall?.args).toMatchObject({
      request: {
        connection_id: 'conn-1',
        topic: 'orders',
        key: 'order-2',
        value: 'hello kafka',
        headers: { trace: 'xyz' },
      },
    });
  });

  test('筛选面板可以切换起点并触发重新拉取', async ({ page }) => {
    await page.getByRole('button', { name: '主题' }).click();
    await page.getByRole('button', { name: 'orders' }).click();
    await page.getByRole('button', { name: '查看数据' }).click();

    await page.getByRole('button', { name: '筛选' }).click();
    const startFrom = page.getByRole('combobox').first();
    await startFrom.selectOption('beginning');
    await page.getByRole('button', { name: '应用' }).click();

    await expect
      .poll(async () => {
        const calls = (await getInvokeCalls(page)).filter((call) => call.cmd === 'fetch_messages');
        return calls[calls.length - 1]?.args.filter;
      })
      .toEqual({ start_from: { type: 'beginning' } });
  });

  test('主题右键菜单提供查询数据、查看属性和未实现项', async ({ page }) => {
    await page.getByRole('button', { name: '主题' }).click();
    const topicLeaf = page.getByRole('button', { name: 'orders' });

    await topicLeaf.click({ button: 'right' });

    const queryItem = page.getByRole('button', { name: '查询数据' });
    await expect(queryItem).toBeVisible();
    // Verify the compact menu styling is actually applied (14px text, 2px vertical padding).
    await expect(queryItem).toHaveCSS('font-size', '14px');
    await expect(queryItem).toHaveCSS('padding-top', '2px');
    await expect(queryItem).toHaveCSS('padding-bottom', '2px');
    await expect(page.getByRole('button', { name: '查看属性' })).toBeVisible();
    await expect(page.getByRole('button', { name: '复制主题名' })).toBeVisible();
    await expect(page.getByRole('button', { name: /编辑/ })).toContainText('尚未实现');
    await expect(page.getByRole('button', { name: /删除/ })).toContainText('尚未实现');

    await page.getByRole('button', { name: '查询数据' }).click();
    await expect(page.getByRole('button', { name: /orders - 数据/ })).toBeVisible();
  });

  test('主题右键菜单的查看属性会打开状态页', async ({ page }) => {
    await page.getByRole('button', { name: '主题' }).click();
    await page.getByRole('button', { name: 'orders' }).click({ button: 'right' });

    await page.getByRole('button', { name: '查看属性' }).click();

    await expect(page.getByRole('button', { name: /orders - 状态/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Leader' })).toBeVisible();
  });

  test('消息右键菜单可以复制 value 并用原消息创建新消息', async ({ page }) => {
    await page.getByRole('button', { name: '主题' }).click();
    await page.getByRole('button', { name: 'orders' }).click();
    await page.getByRole('button', { name: '查看数据' }).click();

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click({ button: 'right' });

    await expect(page.getByRole('button', { name: '复制 value' })).toBeVisible();
    await page.getByRole('button', { name: '再创建一条...' }).click();

    const produceDialog = page.getByRole('dialog');
    await expect(produceDialog).toBeVisible();
    await expect(produceDialog.getByLabel('Value')).toHaveValue('{"id":1}');
    await expect(produceDialog.getByLabel('Key')).toHaveValue('order-1');
  });
});

test.describe('消费者组页面', () => {
  test('消费者组右键菜单提供查询数据、查看属性和未实现项', async ({ page }) => {
    await page.getByRole('button', { name: '消费者组' }).click();
    const groupLeaf = page.getByRole('button', { name: 'group-a' });

    await groupLeaf.click({ button: 'right' });

    await expect(page.getByRole('button', { name: '查询数据' })).toBeVisible();
    await expect(page.getByRole('button', { name: '查看属性' })).toBeVisible();
    await expect(page.getByRole('button', { name: '复制消费者组名' })).toBeVisible();
    await expect(page.getByRole('button', { name: /编辑/ })).toContainText('尚未实现');
    await expect(page.getByRole('button', { name: /删除/ })).toContainText('尚未实现');
  });

  test('连接右键菜单提供刷新、编辑、复制连接信息与删除连接', async ({ page }) => {
    await page.getByRole('button', { name: /本地集群/ }).click({ button: 'right' });

    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible();
    await expect(page.getByRole('button', { name: /编辑/ })).toContainText('尚未实现');
    await expect(page.getByRole('button', { name: '复制连接信息' })).toBeVisible();
    await expect(page.getByRole('button', { name: /删除连接/ })).toContainText('尚未实现');
  });

  test('单击消费者组展示成员与 lag 状态', async ({ page }) => {
    await page.getByRole('button', { name: '消费者组' }).click();
    const groupLeaf = page.getByRole('button', { name: 'group-a' });
    await expect(groupLeaf).toBeVisible();

    await groupLeaf.click();

    await expect(page.getByRole('heading', { name: 'group-a' })).toBeVisible();
    await expect(page.getByText('Stable')).toBeVisible();
    await expect(page.getByText('member-1')).toBeVisible();
    await expect(page.getByText('client-1')).toBeVisible();
    await expect(page.getByText('1500').last()).toBeVisible();

    const groupCall = (await getInvokeCalls(page)).find(
      (call) => call.cmd === 'get_consumer_group_status'
    );
    expect(groupCall?.args).toMatchObject({ connectionId: 'conn-1', groupId: 'group-a' });
  });
});

test.describe('应用菜单', () => {
  test('默认右键菜单被禁用', async ({ page }) => {
    const defaultPrevented = await page.evaluate(() => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    });

    expect(defaultPrevented).toBe(true);
  });

  test('自绘工具栏已被系统菜单替换', async ({ page }) => {
    await expect(page.getByRole('button', { name: '文件' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '帮助' })).toHaveCount(0);
    await expect(page.locator('header')).toHaveCount(0);
  });

  test('前端已订阅系统菜单事件', async ({ page }) => {
    await expect
      .poll(async () => {
        const listenedEvents = (await getInvokeCalls(page))
          .filter((call) => call.cmd === 'plugin:event|listen')
          .map((call) => call.args.event);
        return listenedEvents.filter((event): event is string => typeof event === 'string');
      })
      .toEqual(
        expect.arrayContaining([
          'menu:manage-connections',
          'menu:about',
          'menu:close-project',
        ])
      );
  });
});
