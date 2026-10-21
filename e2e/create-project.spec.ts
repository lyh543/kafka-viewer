import { expect, test, type Page } from '@playwright/test';
import { getInvokeCalls, installTauriMock } from './support/tauri-mock';

const HOME = '/tmp/kafka-viewer-e2e-home';
const DEFAULT_NAME = 'my-project';
const DEFAULT_PATH = `${HOME}/KafkaViewer/projects/${DEFAULT_NAME}`;

async function openCreateProjectDialog(page: Page) {
  await page.getByRole('button', { name: /新建项目/ }).first().click();
  const dialog = page.getByRole('dialog', { name: '新建项目' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  await installTauriMock(page, { home: HOME });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Pure workspace flow/ })).toBeVisible();
});

test.describe('新建项目', () => {
  test('默认填入项目名称与项目位置，用户可直接创建', async ({ page }) => {
    const dialog = await openCreateProjectDialog(page);

    const nameInput = dialog.getByRole('textbox', { name: '项目名称' });
    const pathInput = dialog.getByRole('textbox', { name: '项目位置' });
    const createButton = dialog.getByRole('button', { name: '创建', exact: true });

    await expect(nameInput).toHaveValue(DEFAULT_NAME);
    await expect(pathInput).toHaveValue(DEFAULT_PATH);
    await expect(createButton).toBeEnabled();

    await createButton.click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveTitle(`${DEFAULT_NAME} - kafka-viewer`);
    await expect(page.locator('footer')).toContainText(DEFAULT_NAME);

    const createCall = (await getInvokeCalls(page)).find((call) => call.cmd === 'create_project');
    expect(createCall?.args).toEqual({ name: DEFAULT_NAME, path: DEFAULT_PATH });
  });

  test('修改项目名称时同步更新项目位置', async ({ page }) => {
    const dialog = await openCreateProjectDialog(page);

    const nameInput = dialog.getByRole('textbox', { name: '项目名称' });
    const pathInput = dialog.getByRole('textbox', { name: '项目位置' });

    await nameInput.fill('demo-app');

    await expect(pathInput).toHaveValue(`${HOME}/KafkaViewer/projects/demo-app`);
  });

  test('清空项目名称时禁用创建按钮', async ({ page }) => {
    const dialog = await openCreateProjectDialog(page);

    await dialog.getByRole('textbox', { name: '项目名称' }).fill('');

    await expect(dialog.getByRole('button', { name: '创建', exact: true })).toBeDisabled();
  });

  test('取消后重新打开会恢复默认值', async ({ page }) => {
    let dialog = await openCreateProjectDialog(page);
    await dialog.getByRole('textbox', { name: '项目名称' }).fill('temporary');

    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(dialog).toBeHidden();

    dialog = await openCreateProjectDialog(page);

    await expect(dialog.getByRole('textbox', { name: '项目名称' })).toHaveValue(DEFAULT_NAME);
    await expect(dialog.getByRole('textbox', { name: '项目位置' })).toHaveValue(DEFAULT_PATH);
  });
});
