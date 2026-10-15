import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

const toolPath = `${(process.env.SITE_BASE ?? '/').replace(/\/$/, '')}/tools/csv-plotter/`;
const dataFile = (content: string, name = '中文数据.csv') => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(content),
});
async function upload(page: Page, content: string, name?: string) {
  await page.locator('#csv-file').setInputFiles(dataFile(content, name));
  await page.locator('#csv-start').click();
  await expect(page.locator('#csv-export')).toBeEnabled();
}
async function bytes(download: Download) {
  const path = await download.path();
  expect(path).toBeTruthy();
  return readFile(path!);
}

test.beforeEach(async ({ page }) => {
  await page.goto(toolPath);
});

test('CSV sample parses quoted multiline fields, null gaps, full statistics and real downloads', async ({
  page,
}) => {
  await page.locator('#csv-sample').click();
  await expect(page.locator('#csv-export')).toBeEnabled();
  await expect(page.locator('#csv-filename')).toContainText('合成示例.csv');
  await page.locator('#csv-x').selectOption('0');
  await expect(page.locator('#csv-export')).toBeEnabled();
  await page.locator('#csv-y-0').uncheck();
  await page.locator('#csv-y-2').check();
  await expect(page.locator('#csv-export')).toBeEnabled();
  const temperature = page.locator('#csv-stats tbody tr').filter({ hasText: '温度' });
  await expect(temperature.locator('td').nth(1)).toHaveText('3');
  await expect(temperature.locator('td').nth(2)).toHaveText('1');
  await expect(temperature.locator('td').nth(5)).toHaveText('2.3333333');
  await expect(temperature.locator('td').nth(7)).toHaveText('1.2472191');
  await page.locator('summary').filter({ hasText: '前 20 行' }).click();
  await expect(page.locator('#csv-preview')).toContainText('包含,逗号');
  await expect(page.locator('#csv-preview')).toContainText('包含"引号"');
  await expect(page.locator('#csv-preview')).toContainText('第一行\n第二行');
  const csvPromise = page.waitForEvent('download');
  await page.locator('#csv-export').click();
  const csv = await bytes(await csvPromise);
  expect(csv.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  expect(csv.toString('utf8')).toContain('3,4,2,,0.3\r\n');
  expect(csv.toString('utf8')).toContain('4,5,3,4,\r\n');
  const pngPromise = page.waitForEvent('download');
  await page.locator('#csv-png').click();
  const png = await bytes(await pngPromise);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.length).toBeGreaterThan(1000);
});

test('special headers stay text, duplicate columns stay distinct, fifth selection is rejected', async ({
  page,
}) => {
  await upload(
    page,
    '__proto__,温度,,温度,constructor,<img src=x onerror=alert(1)>\n0,1,2,3,4,5\n1,2,3,4,5,6',
  );
  await expect(page.locator('#csv-ys')).toContainText('温度（第 2 列）');
  await expect(page.locator('#csv-ys')).toContainText('温度（第 4 列）');
  await expect(page.locator('#csv-ys')).toContainText('第 3 列');
  await expect(page.locator('#csv-ys')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#csv-app img')).toHaveCount(0);
  await page.locator('#csv-y-2').check();
  await page.locator('#csv-y-3').check();
  await expect(page.locator('#csv-export')).toBeEnabled();
  await page.locator('#csv-y-4').click();
  await expect(page.locator('#csv-y-4')).not.toBeChecked();
  await expect(page.locator('#csv-selection-error')).toContainText('最多选择 4 条曲线');
  await expect(page.locator('#csv-status')).toContainText('最多同时选择 4 条曲线');
  await expect(page.locator('#csv-ys input:checked')).toHaveCount(4);
});

test('nonmonotonic and invalid X retain source order and each Y has independent missing values', async ({
  page,
}) => {
  await upload(page, 'x,a,b\n3,1,2\n1,3,4\n12abc,5,6\n1,,8\n2,9,10');
  await page.locator('#csv-x').selectOption('0');
  await page.locator('#csv-y-0').uncheck();
  await page.locator('#csv-y-2').check();
  await expect(page.locator('#csv-export')).toBeEnabled();
  await expect(page.locator('#csv-warning')).toContainText('数值 X 非单调');
  await expect(page.locator('#csv-warning')).toContainText('1 行 X 无效');
  const rows = page.locator('#csv-table tbody tr');
  await expect(rows.nth(0).locator('td').nth(2)).toHaveText('3');
  await expect(rows.nth(1).locator('td').nth(2)).toHaveText('1');
  await expect(rows.nth(2).locator('td').nth(2)).toHaveText('—');
  await expect(rows.nth(2).locator('td').nth(3)).toHaveText('—');
  await expect(rows.nth(3).locator('td').nth(3)).toHaveText('—');
  await expect(rows.nth(3).locator('td').nth(4)).toHaveText('8');
  await page.locator('#csv-table-view').selectOption('raw');
  await expect(rows.nth(2).locator('td').nth(2)).toHaveText('12abc');
});

test('cancel then same file reselection, stale exports, parsing errors and size limit recover', async ({
  page,
}) => {
  await upload(page, 'x,y\n0,1\n1,2');
  await page.locator('#csv-header').uncheck();
  await expect(page.locator('#csv-stale')).toBeVisible();
  await expect(page.locator('#csv-export')).toBeDisabled();
  await expect(page.locator('#csv-x')).toBeDisabled();
  const large = dataFile(
    `x,y\n${Array.from({ length: 100_000 }, (_, index) => `${index},${index % 17}`).join('\n')}`,
    '可取消.csv',
  );
  await page.locator('#csv-file').setInputFiles(large);
  // Trigger both real UI handlers in one browser turn so cancellation cannot
  // race the speed of the test computer's CSV parser.
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('#csv-start')!.click();
    document.querySelector<HTMLButtonElement>('#csv-cancel')!.click();
  });
  await expect(page.locator('#csv-status')).toContainText('已取消');
  await page.locator('#csv-file').setInputFiles(large);
  await expect(page.locator('#csv-start')).toBeEnabled();
  await page.locator('#csv-sample').click();
  await expect(page.locator('#csv-export')).toBeEnabled();
  await page.locator('#csv-file').setInputFiles(dataFile('x,y\n1,"never closed'));
  await page.locator('#csv-start').click();
  await expect(page.locator('#csv-status')).toContainText('引号');
  await expect(page.locator('#csv-export')).toBeDisabled();
  await page.locator('#csv-file').setInputFiles({
    name: '超限.csv',
    mimeType: 'text/csv',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 65),
  });
  await expect(page.locator('#csv-status')).toContainText('10 MiB');
  await expect(page.locator('#csv-start')).toBeDisabled();
  await page.locator('#csv-sample').click();
  await expect(page.locator('#csv-export')).toBeEnabled();
});

test('file sentinels stay out of requests, URL and storage, formula text is protected in issue export', async ({
  page,
}) => {
  const sentinel = 'PRIVATE_FIXTURE_SENTINEL_CSV_7E41';
  const filename = `${sentinel}.csv`;
  const before = await page.evaluate(async () => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    indexedDB: await indexedDB.databases(),
    caches: await caches.keys(),
    cookies: document.cookie,
  }));
  const requests: string[] = [];
  const unexpected: string[] = [];
  page.on('request', (request) => {
    requests.push(
      JSON.stringify({ url: request.url(), headers: request.headers(), body: request.postData() }),
    );
    if (
      !['GET', 'HEAD'].includes(request.method()) ||
      new URL(request.url()).origin !== new URL(page.url()).origin
    )
      unexpected.push(request.url());
  });
  page.on('websocket', (socket) => unexpected.push(socket.url()));
  await upload(
    page,
    `x,y,note\n0,-900,${sentinel}\n1,-0.125,normal\n2,=1+1,malicious\n3,  =1+1,space\n4,\t=1+1,tab`,
    filename,
  );
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#csv-issues-export').click();
  const exported = (await bytes(await downloadPromise)).toString('utf8');
  expect(exported).toContain("'=1+1");
  expect(exported).toContain("'  =1+1");
  expect(exported).toContain("'\t=1+1");
  const dataPromise = page.waitForEvent('download');
  await page.locator('#csv-export').click();
  const data = (await bytes(await dataPromise)).toString('utf8');
  expect(data).toContain('-900');
  expect(data).not.toContain("'-900");
  expect(requests.join('')).not.toContain(sentinel);
  expect(unexpected).toEqual([]);
  expect(page.url()).not.toContain(sentinel);
  expect(
    await page.evaluate(async () => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
      indexedDB: await indexedDB.databases(),
      caches: await caches.keys(),
      cookies: document.cookie,
    })),
  ).toEqual(before);
});

test('loaded CSV tool still computes and exports after network is disabled', async ({
  page,
  context,
}) => {
  await page.locator('#csv-sample').click();
  await expect(page.locator('#csv-export')).toBeEnabled();
  await context.setOffline(true);
  try {
    await upload(page, 'x,y\n0,-900\n1,0.0012\n2,4');
    await expect(page.locator('#csv-stats')).toContainText('-298.66627');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#csv-export').click();
    expect((await bytes(await downloadPromise)).toString('utf8')).toContain('-900');
  } finally {
    await context.setOffline(false);
  }
});
