import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#signal-status')).toHaveAttribute('data-state', 'success');
  await expect(page.locator('#signal-export-image')).toBeEnabled();
  await expect(page.locator('#signal-time-chart canvas')).toHaveCount(1);
  await expect(page.locator('#signal-spectrum-chart canvas')).toHaveCount(1);
}

test('E-DSP-01/02/03: real initial results, presets, validation and reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/lab/signal-studio/');
  await ready(page);
  await expect(page.locator('#signal-delta')).toHaveText('1 Hz');
  await expect(page.locator('#signal-duration')).toHaveText('1 s');
  await expect(page.locator('#signal-data-table tr')).toHaveCount(16);
  await page.getByRole('button', { name: '混叠示例', exact: true }).click();
  await expect(page.locator('#signal-peak')).toHaveText('124 Hz');
  await ready(page);
  await expect(page.locator('#signal-warnings')).toContainText('超过奈奎斯特频率');
  await expect(page.locator('#signal-f1')).toHaveValue('900');
  await page.locator('#signal-fs').selectOption('128');
  await expect(page.locator('#signal-f1-error')).toContainText('0 到 256');
  await expect(page.locator('#signal-f1')).toHaveValue('900');
  await expect(page.locator('#signal-f1')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#signal-export-time')).toBeDisabled();
  await expect(page.locator('#signal-status')).toContainText('结果已过期');
  await page.getByRole('button', { name: '重置参数', exact: true }).click();
  await expect(page.locator('#signal-f1')).toHaveValue('50');
  await expect(page.locator('#signal-f2')).toHaveValue('120');
  await expect(page.locator('#signal-fs')).toHaveValue('1024');
  await expect(page.locator('#signal-seed')).toHaveValue('20261015');
  await expect(page.locator('#signal-window')).toHaveValue('hann-periodic');
  await expect(page.locator('#signal-peak')).toHaveText('50 Hz');
  await ready(page);
  expect(errors).toEqual([]);
});

test('E-DSP-04: bounded links, explicit sharing and browser history', async ({ page }) => {
  await page.goto('/lab/signal-studio/?n=999999999&window=%3Cscript%3E');
  await ready(page);
  await expect(page.locator('#signal-n')).toHaveValue('1024');
  await expect(page.locator('#signal-warnings')).toContainText('已恢复默认参数');
  await page.getByRole('button', { name: '混叠示例', exact: true }).click();
  await expect(page.locator('#signal-peak')).toHaveText('124 Hz');
  await ready(page);
  await page.getByRole('button', { name: '复制参数链接', exact: true }).click();
  const shared = new URL(page.url());
  expect(shared.searchParams.get('f1')).toBe('900');
  expect(shared.searchParams.get('seed')).toBe('20261015');
  expect([...shared.searchParams.keys()].sort()).toEqual(
    [
      'a1',
      'a2',
      'dc',
      'f1',
      'f2',
      'fs',
      'n',
      'noiseAmplitude',
      'phase1',
      'phase2',
      'seed',
      'window',
    ].sort(),
  );
  await page.getByRole('button', { name: '重置参数', exact: true }).click();
  await expect(page.locator('#signal-peak')).toHaveText('50 Hz');
  await ready(page);
  await page.goBack();
  await expect(page.locator('#signal-f1')).toHaveValue('900');
  await expect(page.locator('#signal-peak')).toHaveText('124 Hz');
  await ready(page);
  await page.goForward();
  await expect(page.locator('#signal-f1')).toHaveValue('50');
  await expect(page.locator('#signal-peak')).toHaveText('50 Hz');
  await ready(page);
});

test('E-DSP-05: full CSV exports and actual PNG bytes', async ({ page }) => {
  await page.goto('/lab/signal-studio/');
  await ready(page);
  for (const fixture of [
    {
      id: 'signal-export-time',
      filename: 'signal-time-synthetic.csv',
      rows: 1025,
      prefix: '\uFEFFsample_index,time_s,signal_amplitude\r\n',
    },
    {
      id: 'signal-export-spectrum',
      filename: 'signal-spectrum-synthetic.csv',
      rows: 514,
      prefix: '\uFEFFfrequency_Hz,one_sided_linear_amplitude\r\n',
    },
  ]) {
    const pending = page.waitForEvent('download');
    await page.locator(`#${fixture.id}`).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(fixture.filename);
    const path = await download.path();
    expect(path).toBeTruthy();
    const csv = await readFile(path!, 'utf8');
    expect(csv.startsWith(fixture.prefix)).toBe(true);
    expect(csv.trimEnd().split('\r\n')).toHaveLength(fixture.rows);
  }
  for (const id of ['signal-export-image', 'signal-export-time-image']) {
    const pending = page.waitForEvent('download');
    await page.locator(`#${id}`).click();
    const download = await pending;
    const png = await readFile((await download.path())!);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.byteLength).toBeGreaterThan(5000);
  }
});

test('E-THEME-02 / E-DSP-06: keyboard controls, range sync and zoom survive theme changes', async ({
  page,
}) => {
  await page.goto('/lab/signal-studio/');
  await ready(page);
  const range = page.getByRole('slider', { name: '分量 1 幅度滑块' });
  await range.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#signal-a1')).toHaveValue('1.01');
  await page.locator('#signal-a1').fill('1.25');
  await expect(range).toHaveValue('1.25');
  await ready(page);
  await page.getByRole('button', { name: '查看前 1/4 时域', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#signal-time-chart')).toHaveAttribute('data-view-end', '25');
  await page.getByRole('combobox', { name: '选择主题' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#signal-time-chart')).toHaveAttribute('data-view-end', '25');
  await expect(page.locator('#signal-a1')).toHaveValue('1.25');
  await expect(page.locator('#signal-data-table tr')).toHaveCount(16);
  await expect(page.locator('#signal-time-chart canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '重置视图', exact: true }).click();
  await expect(page.locator('#signal-time-chart')).toHaveAttribute('data-view-end', '100');
});

test('E-DSP-07: mobile 320px remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto('/lab/signal-studio/');
  await ready(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '干净双音', exact: true }).click();
  await expect(page.locator('#signal-peak')).toHaveText('64 Hz');
  await ready(page);
  await page.screenshot({ path: test.info().outputPath('signal-mobile-320.png'), fullPage: true });
});

test('loaded signal studio computes and exports after going offline', async ({ page, context }) => {
  await page.goto('/lab/signal-studio/');
  await ready(page);
  await context.setOffline(true);
  try {
    await page.locator('#signal-n').selectOption('8192');
    await page.locator('#signal-f1').fill('64');
    await expect(page.locator('#signal-peak')).toHaveText('64 Hz');
    await expect(page.locator('#signal-status')).toContainText('8192 个样本');
    await ready(page);
    await expect(page.locator('#signal-sample-description')).toContainText('原始 8192 点');
    await expect(page.locator('#signal-export-time')).toBeEnabled();
  } finally {
    await context.setOffline(false);
  }
});

test('signal rendered parameter response measurement', async ({ page }) => {
  await page.goto('/lab/signal-studio/');
  await ready(page);
  const timings: number[] = [];
  for (const frequency of [64, 80, 96]) {
    const duration = await page.evaluate(
      (nextFrequency) =>
        new Promise<number>((resolve, reject) => {
          const input = document.querySelector<HTMLInputElement>('#signal-f1')!;
          const chart = document.querySelector('#signal-spectrum-chart')!;
          const started = performance.now();
          const timeout = setTimeout(() => {
            observer.disconnect();
            reject(new Error('参数更新超时'));
          }, 5000);
          const observer = new MutationObserver(() => {
            if (!chart.getAttribute('aria-label')?.includes(`最大频点 ${nextFrequency} Hz`)) return;
            observer.disconnect();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                clearTimeout(timeout);
                resolve(performance.now() - started);
              }),
            );
          });
          observer.observe(chart, { attributes: true, attributeFilter: ['aria-label'] });
          input.value = String(nextFrequency);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }),
      frequency,
    );
    timings.push(duration);
  }
  const metrics = JSON.stringify(
    {
      metric: 'Browser input event through computed spectrum, setOption and two animation frames',
      sampleCount: 1024,
      debounceMs: 100,
      durationsMs: timings,
      medianMs: [...timings].sort((a, b) => a - b)[1],
      browser: page.context().browser()!.version(),
      viewport: page.viewportSize(),
    },
    null,
    2,
  );
  const metricsPath = test.info().outputPath('signal-parameter-response.json');
  await writeFile(metricsPath, metrics);
  await test.info().attach('signal-parameter-response.json', {
    path: metricsPath,
    contentType: 'application/json',
  });
  await page.screenshot({ path: test.info().outputPath('signal-desktop.png'), fullPage: true });
});
