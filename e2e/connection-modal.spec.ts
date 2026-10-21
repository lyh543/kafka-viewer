import { expect, test, type Page } from '@playwright/test';
import {
  getInvokeCalls,
  installTauriMock,
  type ConnectionFixture,
} from './support/tauri-mock';

const HOME = '/tmp/kafka-viewer-e2e-home';

function existingConnection(overrides: Partial<ConnectionFixture> = {}): ConnectionFixture {
  return {
    id: 'conn-1',
    name: '本地 Kafka',
    brokers: 'localhost:9092',
    auth: { type: 'none' },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Creates the default project so the main window (and its menu bar) is rendered. */
async function openProject(page: Page) {
  await page.getByRole('button', { name: /新建项目/ }).first().click();
  const dialog = page.getByRole('dialog', { name: '新建项目' });
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function openConnectionManager(page: Page) {
  await page.getByRole('button', { name: '文件' }).click();
  await page.getByRole('menuitem', { name: '管理连接' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '新增连接' })).toBeVisible();
  return dialog;
}

test.describe('管理连接', () => {
  test('新建连接默认值可直接保存，保存后才调用后端', async ({ page }) => {
    await installTauriMock(page, { home: HOME });
    await page.goto('/');
    await openProject(page);

    const dialog = await openConnectionManager(page);
    await expect(dialog.getByText('暂无连接')).toBeVisible();

    await dialog.getByRole('button', { name: '新增连接' }).click();

    await expect(dialog.getByLabel('连接名称')).toHaveValue('新连接');
    await expect(dialog.getByLabel('Brokers')).toHaveValue('localhost:9092');

    const saveButton = dialog.getByRole('button', { name: '保存', exact: true });
    await expect(saveButton).toBeEnabled();

    await saveButton.click();

    await expect(page.getByText('连接已保存')).toBeVisible();
    // Nothing left to save after persisting.
    await expect(saveButton).toBeDisabled();

    const saves = (await getInvokeCalls(page)).filter((call) => call.cmd === 'save_connection');
    expect(saves).toHaveLength(1);
    expect(saves[0].args.connection).toMatchObject({
      name: '新连接',
      brokers: 'localhost:9092',
    });
  });

  test('新建连接未保存就取消，不会出现在连接列表', async ({ page }) => {
    await installTauriMock(page, { home: HOME });
    await page.goto('/');
    await openProject(page);

    let dialog = await openConnectionManager(page);
    await dialog.getByRole('button', { name: '新增连接' }).click();
    await dialog.getByLabel('连接名称').fill('临时连接');

    await expect(dialog.getByText('临时连接').first()).toBeVisible();

    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(dialog).toBeHidden();

    dialog = await openConnectionManager(page);
    await expect(dialog.getByText('暂无连接')).toBeVisible();
    await expect(dialog.getByText('临时连接')).toHaveCount(0);

    const calls = await getInvokeCalls(page);
    expect(calls.some((call) => call.cmd === 'save_connection')).toBe(false);
    expect(calls.some((call) => call.cmd === 'delete_connection')).toBe(false);
  });

  test('保存后的连接在重新打开管理连接后仍然存在', async ({ page }) => {
    await installTauriMock(page, { home: HOME });
    await page.goto('/');
    await openProject(page);

    let dialog = await openConnectionManager(page);
    await dialog.getByRole('button', { name: '新增连接' }).click();
    await dialog.getByLabel('连接名称').fill('本地测试');
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('连接已保存')).toBeVisible();

    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(dialog).toBeHidden();

    dialog = await openConnectionManager(page);
    await expect(dialog.getByText('本地测试', { exact: true })).toBeVisible();

    const reads = (await getInvokeCalls(page)).filter((call) => call.cmd === 'get_connections');
    // Loaded again every time the dialog is opened (React StrictMode may double-invoke).
    expect(reads.length).toBeGreaterThanOrEqual(2);
  });

  test('测试连接以紧凑形式展示指标，键值位于同一行且弹窗不超出视口', async ({ page }) => {
    await installTauriMock(page, { home: HOME });
    await page.goto('/');
    await openProject(page);

    const dialog = await openConnectionManager(page);
    await dialog.getByRole('button', { name: '新增连接' }).click();
    await dialog.getByRole('button', { name: '测试连接' }).click();

    await expect(dialog.getByText('连接成功')).toBeVisible();

    const pingLabel = dialog.getByText('Ping', { exact: true });
    const pingValue = dialog.getByText('0 ms', { exact: true });
    await expect(pingLabel).toBeVisible();
    await expect(pingValue).toBeVisible();

    const [labelBox, valueBox] = await Promise.all([
      pingLabel.boundingBox(),
      pingValue.boundingBox(),
    ]);
    expect(labelBox).not.toBeNull();
    expect(valueBox).not.toBeNull();
    // Key and value share the same row.
    expect(Math.abs(labelBox!.y + labelBox!.height / 2 - (valueBox!.y + valueBox!.height / 2))).toBeLessThan(2);

    for (const metric of ['1', '5', '54', 'localhost:9092']) {
      await expect(dialog.getByText(metric, { exact: true }).first()).toBeVisible();
    }

    const dialogBox = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(dialogBox!.height).toBeLessThanOrEqual(viewport!.height * 0.93);
  });

  test('删除已保存的连接会调用后端并清空列表', async ({ page }) => {
    await installTauriMock(page, { home: HOME, connections: [existingConnection()] });
    await page.goto('/');
    await openProject(page);

    const dialog = await openConnectionManager(page);
    await dialog.getByRole('button', { name: /本地 Kafka/ }).click();
    await dialog.getByRole('button', { name: '删除', exact: true }).click();

    await expect(dialog.getByText('暂无连接')).toBeVisible();
    await expect(dialog.getByText('本地 Kafka')).toHaveCount(0);

    const deletes = (await getInvokeCalls(page)).filter((call) => call.cmd === 'delete_connection');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].args).toEqual({ id: 'conn-1' });
  });

  test('取消编辑已保存的连接不会保存修改', async ({ page }) => {
    await installTauriMock(page, { home: HOME, connections: [existingConnection()] });
    await page.goto('/');
    await openProject(page);

    let dialog = await openConnectionManager(page);
    await dialog.getByRole('button', { name: /本地 Kafka/ }).click();
    await dialog.getByLabel('连接名称').fill('改过的名字');
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(dialog).toBeHidden();

    dialog = await openConnectionManager(page);
    await dialog.getByRole('button', { name: /本地 Kafka/ }).click();
    await expect(dialog.getByLabel('连接名称')).toHaveValue('本地 Kafka');
    await expect(dialog.getByText('改过的名字')).toHaveCount(0);

    const calls = await getInvokeCalls(page);
    expect(calls.some((call) => call.cmd === 'save_connection')).toBe(false);
  });

  test('必填项为空时保存按钮不可用', async ({ page }) => {
    await installTauriMock(page, { home: HOME });
    await page.goto('/');
    await openProject(page);

    const dialog = await openConnectionManager(page);
    await dialog.getByRole('button', { name: '新增连接' }).click();

    const saveButton = dialog.getByRole('button', { name: '保存', exact: true });
    await expect(saveButton).toBeEnabled();

    await dialog.getByLabel('Brokers').fill('');
    await expect(saveButton).toBeDisabled();

    await dialog.getByLabel('Brokers').fill('localhost:9092');
    await dialog.getByLabel('连接名称').fill('');
    await expect(saveButton).toBeDisabled();
  });

  test('复制连接只生成草稿，取消后不会残留在列表', async ({ page }) => {
    await installTauriMock(page, { home: HOME, connections: [existingConnection()] });
    await page.goto('/');
    await openProject(page);

    let dialog = await openConnectionManager(page);
    await dialog.getByRole('button', { name: /本地 Kafka/ }).click();
    await dialog.getByRole('button', { name: '复制', exact: true }).click();

    await expect(dialog.getByLabel('连接名称')).toHaveValue('本地 Kafka (副本)');

    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(dialog).toBeHidden();

    dialog = await openConnectionManager(page);
    await expect(dialog.getByText('本地 Kafka', { exact: true })).toHaveCount(1);
    await expect(dialog.getByText('本地 Kafka (副本)')).toHaveCount(0);

    const calls = await getInvokeCalls(page);
    expect(calls.some((call) => call.cmd === 'save_connection')).toBe(false);
  });
});
