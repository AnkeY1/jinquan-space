import { firefox, webkit, expect as baseExpect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';

const expect = baseExpect.configure({ timeout: 15_000 });
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const evidenceDirectory = resolve(projectRoot, 'docs/evidence');
await mkdir(evidenceDirectory, { recursive: true });
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const browserRegistry = JSON.parse(
  await readFile(resolve(projectRoot, 'node_modules/playwright-core/browsers.json'), 'utf8'),
);
const report = {
  checkedAt: new Date().toISOString(),
  baseURL,
  environment: {
    platform: process.platform,
    node: process.version,
    architecture: process.arch,
    cpu: cpus()[0]?.model || 'unknown',
    // A local host label is deliberately omitted from the distributable report.
    headless: true,
  },
  scope:
    'Production static-site smoke; desktop 1280x800 and mobile 390x844, local synthetic examples only.',
  browsers: [],
};

async function downloadBytes(page, selector, mime, output) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await pending;
  const location = await download.path();
  assert.ok(location, 'Browser did not provide a downloaded file.');
  const bytes = await readFile(location);
  if (mime === 'png') {
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(bytes.length > 1000, 'PNG download is unexpectedly small.');
  } else {
    assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
    assert.ok(bytes.toString('utf8').includes('\r\n'), 'CSV does not use CRLF.');
  }
  output.push({
    selector,
    filename: download.suggestedFilename(),
    type: mime,
    bytes: bytes.length,
    signatureHex: bytes.subarray(0, mime === 'png' ? 8 : 3).toString('hex'),
  });
  return bytes;
}

for (const [name, browserType] of Object.entries({ firefox, webkit })) {
  const registration = browserRegistry.browsers.find((entry) => entry.name === name);
  const outcome = {
    name,
    status: 'pending',
    version: null,
    installedBuild: registration
      ? { version: registration.browserVersion, revision: registration.revision }
      : null,
    checks: [],
    downloads: [],
    pageErrors: [],
    screenshots: [],
  };
  report.browsers.push(outcome);
  if (!existsSync(browserType.executablePath())) {
    outcome.status = 'unavailable';
    outcome.error =
      'Playwright browser executable is not installed. Run: npx playwright install firefox webkit';
    console.error(`${name}: ${outcome.error}`);
    continue;
  }
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
    outcome.version = browser.version();
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(20_000);
    page.on('pageerror', (error) => outcome.pageErrors.push(error.message));
    const screenshot = async (filename, fullPage = true) => {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo({ top: 0, behavior: 'instant' });
        return getComputedStyle(document.body).color;
      });
      await page.evaluate(
        () =>
          new Promise((resolveFrame) =>
            requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
          ),
      );
      // Allow the site's 150ms control transitions and WebKit glyph repaint to settle.
      await page.waitForTimeout(250);
      await page.screenshot({ path: resolve(evidenceDirectory, filename), fullPage });
      outcome.screenshots.push(`docs/evidence/${filename}`);
    };
    const step = async (title, action) => {
      const started = performance.now();
      try {
        await action();
        outcome.checks.push({
          title,
          status: 'passed',
          elapsedMs: Math.round(performance.now() - started),
        });
        console.log(`${name} ${outcome.version} PASS ${title}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outcome.checks.push({
          title,
          status: 'failed',
          elapsedMs: Math.round(performance.now() - started),
          error: message,
        });
        console.error(`${name} ${outcome.version} FAIL ${title}: ${message}`);
        await screenshot(`${name}-failure-${outcome.checks.length}.png`).catch(() => {});
      }
    };

    await step('home content and light-theme screenshot', async () => {
      const response = await page.goto('/');
      assert.equal(response?.status(), 200);
      await expect(page.locator('h1')).toContainText('把想法做成');
      await page.locator('#theme-select').selectOption('light');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await screenshot(`${name}-smoke.png`);
    });
    await step('article body, table of contents and local navigation', async () => {
      await page.goto('/articles/log-time-difference/');
      await expect(page.locator('h1')).toHaveCount(1);
      const toc = page.getByRole('navigation', { name: '本文目录' });
      await toc.getByRole('link', { name: '负差值提供了什么信息' }).click();
      assert.ok(decodeURIComponent(new URL(page.url()).hash).includes('负差值'));
      await expect(page.locator('.copy-button').first()).toBeVisible();
    });
    await step('mobile menu, Escape focus and 390px overflow', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      const menu = page.locator('.mobile-menu summary');
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await expect(
        page
          .getByRole('navigation', { name: '移动主导航' })
          .getByRole('link', { name: '项目', exact: true }),
      ).toBeVisible();
      await screenshot(`${name}-mobile-menu.png`, false);
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    });
    await step('theme changes persist through refresh', async () => {
      await page.locator('#theme-select').selectOption('dark');
      await expect(page.locator('body')).toHaveCSS('color', 'rgb(231, 237, 244)');
      await page.reload();
      await expect(page.locator('#theme-select')).toHaveValue('dark');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.locator('#theme-select').selectOption('system');
      await expect(page.locator('#theme-select')).toHaveValue('system');
      await page.setViewportSize({ width: 1280, height: 800 });
    });
    await step('Chinese search and hash restoration', async () => {
      await page.goto('/search/');
      await page.locator('#search-query').fill('时间差');
      await page.getByRole('button', { name: '搜索 ↗', exact: true }).click();
      await expect(page.locator('#search-results article')).toHaveCount(3);
      await expect(page.locator('#search-results mark').first()).toHaveText('时间差');
      await page.reload();
      await expect(page.locator('#search-results article')).toHaveCount(3);
    });
    await step('log example calculation, original CSV and PNG', async () => {
      await page.goto('/tools/log-analyzer/');
      await page.locator('#log-example').click();
      await expect(page.locator('#log-status')).toContainText(/分析完成|部分完成/);
      await expect(page.locator('#log-stats-comparison')).toContainText('6.4');
      await expect(page.locator('#log-chart-a canvas')).toHaveCount(1);
      const csv = await downloadBytes(page, '#log-export-a', 'csv', outcome.downloads);
      assert.ok(csv.toString('utf8').includes(',-900,'));
      await downloadBytes(page, '[data-png="a"]', 'png', outcome.downloads);
    });
    await step('CSV multiline example calculation, statistics and CSV/PNG', async () => {
      await page.goto('/tools/csv-plotter/');
      await page.locator('#csv-sample').click();
      await expect(page.locator('#csv-export')).toBeEnabled();
      await expect(page.locator('#csv-stats')).toContainText('2.3333333');
      const csv = await downloadBytes(page, '#csv-export', 'csv', outcome.downloads);
      assert.ok(
        csv.toString('utf8').includes('2.3333333') === false,
        'CSV must export samples, not rounded summary statistics.',
      );
      await downloadBytes(page, '#csv-png', 'png', outcome.downloads);
    });
    await step('signal real computation, alias preset and CSV/PNG', async () => {
      await page.goto('/lab/signal-studio/');
      await expect(page.locator('#signal-status')).toHaveAttribute('data-state', 'success');
      await expect(page.locator('#signal-export-image')).toBeEnabled();
      await expect(page.locator('#signal-peak')).toHaveText('50 Hz');
      await page.getByRole('button', { name: '混叠示例', exact: true }).click();
      await expect(page.locator('#signal-peak')).toHaveText('124 Hz');
      await expect(page.locator('#signal-warnings')).toContainText('超过奈奎斯特频率');
      await expect(page.locator('#signal-export-image')).toBeEnabled();
      const csv = await downloadBytes(page, '#signal-export-time', 'csv', outcome.downloads);
      assert.equal(csv.toString('utf8').trimEnd().split('\r\n').length, 1025);
      await downloadBytes(page, '#signal-export-image', 'png', outcome.downloads);
      await page.locator('#theme-select').selectOption('dark');
      await expect(page.locator('body')).toHaveCSS('color', 'rgb(231, 237, 244)');
      await expect(page.locator('#signal-peak')).toHaveText('124 Hz');
      await screenshot(`${name}-signal-smoke.png`);
    });
    await step('no uncaught browser exceptions', async () => {
      assert.deepEqual(outcome.pageErrors, []);
    });
    outcome.status = outcome.checks.every((check) => check.status === 'passed')
      ? 'passed'
      : 'failed';
    await context.close();
  } catch (error) {
    outcome.status = 'failed';
    outcome.error = error instanceof Error ? error.message : String(error);
    console.error(`${name}: ${outcome.error}`);
  } finally {
    await browser?.close();
  }
}

const destination = resolve(evidenceDirectory, 'secondary-browser-smoke.json');
await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
console.log(`Report: ${destination}`);
if (!report.browsers.every((browser) => browser.status === 'passed')) process.exitCode = 1;
