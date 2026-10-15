import { test, expect, type Page, type Download } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

const route = '/tools/log-analyzer/';
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const fixture = (name: string) =>
  new URL(`../fixtures/log/${name}.log`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const line = (ping: number, ms: number) => `PingNumber: ${ping} Time: 26 10 15 10 00 00 ${ms}`;
async function complete(page: Page) {
  await expect(page.locator('#log-status')).toContainText(/分析完成|部分完成/, { timeout: 15_000 });
}
async function downloaded(download: Download) {
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!);
}
async function csv(page: Page, selector: string) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return downloaded(await pending);
}
async function loadFiles(page: Page, a: string, b?: string) {
  await page.locator('#log-file-a').setInputFiles(fixture(a));
  if (b) await page.locator('#log-file-b').setInputFiles(fixture(b));
  await page.locator('#log-start').click();
  await complete(page);
}

test('双日志示例、正负超界、CSV 原值和真实 PNG', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(route);
  await page.locator('#log-example').click();
  await complete(page);
  await expect(page.locator('#log-stats-a')).toContainText('350');
  await expect(page.locator('#log-stats-comparison')).toContainText('6.4');
  await page.locator('#log-focus').check();
  await expect(page.locator('#log-chart-note-a')).toContainText('上 1 点、下 1 点');
  await expect(page.locator('#log-chart-note-b')).toContainText('上 1 点、下 1 点');
  await page.locator('#log-table-kind').selectOption('outliers');
  await expect(page.locator('#log-table tbody tr')).toHaveCount(4);
  await expect(page.locator('#log-table')).toContainText('-900');
  const intervalCsv = await csv(page, '#log-export-a');
  expect([...intervalCsv.subarray(0, 3)]).toEqual([239, 187, 191]);
  const text = intervalCsv.toString('utf8');
  expect(text).toContain(',2100,');
  expect(text).toContain(',-900,');
  expect(text).toContain('\r\n');
  const comparisonCsv = (await csv(page, '#log-export-comparison')).toString('utf8');
  expect(
    comparisonCsv
      .trim()
      .split('\r\n')
      .map((r) => r.split(',').at(-1))
      .slice(1),
  ).toEqual(['5', '8', '6', '8', '5']);
  const pending = page.waitForEvent('download');
  await page.locator('[data-png="a"]').click();
  const png = await downloaded(await pending);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.length).toBeGreaterThan(1000);
  await testInfo.attach('focused-chart.png', { body: png, contentType: 'image/png' });
  await page.locator('#log-focus').uncheck();
  await expect(page.locator('#log-chart-note-a')).toContainText('完整范围');
  await page.locator('#log-focus').check();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) {
      await page.locator('#theme-select').selectOption(theme);
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await page.screenshot({
        path: testInfo.outputPath(`log-success-${viewport.width}-${theme}.png`),
        fullPage: true,
      });
      await page
        .locator('#log-a-section')
        .screenshot({ path: testInfo.outputPath(`log-chart-${viewport.width}-${theme}.png`) });
    }
  }
  expect(pageErrors).toEqual([]);
});

test('重号唯一配对、分段选择和旧结果保护', async ({ page }) => {
  await page.goto(route);
  await loadFiles(page, 'duplicate-a', 'duplicate-b');
  await expect(page.locator('#log-comparison-scope')).toContainText(
    '重号排除 1 个编号（A 2 条 / B 1 条）',
  );
  await page.locator('#log-table-kind').selectOption('comparison');
  await expect(page.locator('#log-table tbody tr')).toHaveCount(2);
  await page.locator('#log-clear').click();
  await loadFiles(page, 'rollback', 'rollback');
  await expect(page.locator('#log-segment-a option')).toHaveCount(2);
  await page.locator('#log-segment-a').selectOption('2');
  await page.locator('#log-segment-b').selectOption('2');
  await expect(page.locator('#log-stale')).toBeVisible();
  await expect(page.locator('#log-export-a')).toBeDisabled();
  await page.locator('#log-start').click();
  await complete(page);
  await expect(page.locator('#log-comparison-scope')).toContainText('A 第 2 段 / B 第 2 段');
  await page.locator('#log-table-kind').selectOption('comparison');
  await expect(page.locator('#log-table tbody tr')).toHaveCount(2);
  await expect(page.locator('#log-table tbody tr').first()).toContainText('1');
});

test('空文件、二进制、编码失败和无匹配均可恢复', async ({ page }) => {
  await page.goto(route);
  await page
    .locator('#log-file-a')
    .setInputFiles({ name: '空日志.log', mimeType: 'text/plain', buffer: Buffer.alloc(0) });
  await expect(page.locator('#log-status')).toContainText('文件为空');
  await page.locator('#log-file-a').setInputFiles({
    name: '错误编码.log',
    mimeType: 'text/plain',
    buffer: Buffer.from([0xff, 0xfe, 0x00]),
  });
  await page.locator('#log-start').click();
  await expect(page.locator('#log-status')).toContainText('DECODE_ERROR');
  await page
    .locator('#log-file-a')
    .setInputFiles({ name: '二进制.log', mimeType: 'text/plain', buffer: Buffer.from('abc\0') });
  await page.locator('#log-start').click();
  await expect(page.locator('#log-status')).toContainText('BINARY_CONTENT');
  await page.locator('#log-file-a').setInputFiles({
    name: '中文日志A.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(line(1, 0)),
  });
  await page.locator('#log-file-b').setInputFiles({
    name: '中文日志B.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(line(2, 5)),
  });
  await page.locator('#log-start').click();
  await complete(page);
  await expect(page.locator('#log-no-pairs')).toBeVisible();
  await expect(page.locator('#log-chart-comparison')).toBeHidden();
  await expect(page.locator('#log-name-a')).toContainText('中文日志A.log');
  await page.locator('#log-example').click();
  await complete(page);
  await expect(page.locator('#log-no-pairs')).toBeHidden();
});

test('日志中 HTML 仅作文本显示，候选错误产生断点', async ({ page }) => {
  await page.goto(route);
  const input =
    line(1, 0) + '\nPingNumber: <img src=x onerror=alert(1)> Time: invalid\n' + line(2, 100);
  await page
    .locator('#log-file-a')
    .setInputFiles({ name: '不可信文本.log', mimeType: 'text/plain', buffer: Buffer.from(input) });
  await page.locator('#log-start').click();
  await complete(page);
  await page.locator('#log-detail-summary').click();
  await expect(page.locator('#log-details')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#log-details img, #log-summary script')).toHaveCount(0);
  await expect(page.locator('#log-stats-a')).toContainText('0');
  const output = (await csv(page, '#log-export-a')).toString('utf8');
  expect(output).toContain(',after-invalid-candidate');
});

test('按所选 GB18030 严格解码，不自动猜测编码', async ({ page }) => {
  await page.goto(route);
  const buffer = Buffer.concat([
    Buffer.from([0xd6, 0xd0, 0xce, 0xc4, 0x0a]),
    Buffer.from(line(1, 0)),
  ]);
  await page
    .locator('#log-file-a')
    .setInputFiles({ name: 'GB18030中文日志.log', mimeType: 'text/plain', buffer });
  await page.locator('#log-start').click();
  await expect(page.locator('#log-status')).toContainText('DECODE_ERROR');
  await page.locator('#log-inputs details').first().locator('summary').click();
  await page.locator('#log-encoding').selectOption('gb18030');
  await page.locator('#log-start').click();
  await complete(page);
  await expect(page.locator('#log-table tbody tr')).toHaveCount(1);
  await expect(page.locator('#log-name-a')).toContainText('GB18030中文日志.log');
});

test('取消后立即更换文件及相同文件重复选择', async ({ page }) => {
  await page.goto(route);
  const many = Array.from({ length: 50_000 }, (_, i) => line(i, i % 1000)).join('\n');
  await page
    .locator('#log-file-a')
    .setInputFiles({ name: '较大日志.log', mimeType: 'text/plain', buffer: Buffer.from(many) });
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('#log-start')!.click();
    document.querySelector<HTMLButtonElement>('#log-cancel')!.click();
  });
  await expect(page.locator('#log-status')).toContainText('已取消');
  await loadFiles(page, 'cross-year');
  await expect(page.locator('#log-stats-a')).toContainText('100');
  await page.locator('#log-file-a').setInputFiles(fixture('cross-year'));
  await expect(page.locator('#log-stale')).toBeVisible();
  await expect(page.locator('#log-export-a')).toBeDisabled();
  await page.locator('#log-start').click();
  await complete(page);
  await expect(page.locator('#log-table tbody tr')).toHaveCount(2);
});

test('页面资源加载后断网仍可重新分析、取消和导出', async ({ page, context }) => {
  await page.goto(route);
  await page.locator('#log-example').click();
  await complete(page);
  await context.setOffline(true);
  await page.locator('#log-clear').click();
  await loadFiles(page, 'standard-a', 'standard-b');
  await expect(page.locator('#log-stats-comparison')).toContainText('6.4');
  const output = (await csv(page, '#log-export-a')).toString('utf8');
  expect(output).toContain(',-900,');
  await context.setOffline(false);
});

test('跨年计算在亚洲和美洲浏览器时区一致', async ({ browser }) => {
  for (const timezoneId of ['Asia/Shanghai', 'America/New_York']) {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    await page.goto(new URL(route, origin).href);
    await loadFiles(page, 'cross-year');
    await expect(page.locator('#log-table tbody tr').nth(1)).toContainText('100');
    const output = (await csv(page, '#log-export-a')).toString('utf8');
    expect(output).toContain(',100,');
    await context.close();
  }
});

test('10,000 条日志性能、分页和本地数据边界', async ({ page }, testInfo) => {
  await page.goto(route);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') requests.push(`${request.method()} ${request.url()}`);
  });
  const content = Array.from(
    { length: 10_000 },
    (_, i) =>
      `PingNumber: ${i} Time: 26 10 15 10 ${Math.floor(i / 600)} ${Math.floor(i / 10) % 60} ${(i % 10) * 100}`,
  ).join('\n');
  await page.locator('#log-file-a').setInputFiles({
    name: 'privacy-sentinel-10k.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(content),
  });
  const start = performance.now();
  await page.locator('#log-start').click();
  await complete(page);
  const elapsedMs = performance.now() - start;
  await expect(page.locator('#log-page-info')).toContainText('共 10,000 条');
  await expect(page.locator('#log-table tbody tr')).toHaveCount(50);
  await page.locator('#log-page-size').selectOption('100');
  await expect(page.locator('#log-table tbody tr')).toHaveCount(100);
  await page.locator('#log-next').click();
  await expect(page.locator('#log-table tbody tr').first()).toContainText('101');
  expect(requests).toEqual([]);
  expect(page.url()).not.toContain('privacy-sentinel');
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(storage)).not.toContain('privacy-sentinel');
  expect(JSON.stringify(storage)).not.toContain('PingNumber');
  const metadata = JSON.stringify(
    {
      records: 10_000,
      elapsedMs,
      viewport: page.viewportSize(),
      browser: 'Chromium automated desktop',
      note: 'Observed run; not a real-device guarantee.',
    },
    null,
    2,
  );
  const metadataPath = testInfo.outputPath('log-10k-performance.json');
  await writeFile(metadataPath, metadata);
  await testInfo.attach('log-10k-performance.json', {
    path: metadataPath,
    contentType: 'application/json',
  });
});
