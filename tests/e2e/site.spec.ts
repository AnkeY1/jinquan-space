import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
const routes = [
  '/',
  '/projects/',
  '/projects/log-analyzer/',
  '/projects/csv-plotter/',
  '/projects/signal-studio/',
  '/articles/',
  '/articles/log-time-difference/',
  '/articles/local-first-tools/',
  '/articles/sampling-and-spectrum/',
  '/tools/',
  '/tools/log-analyzer/',
  '/tools/csv-plotter/',
  '/lab/',
  '/lab/signal-studio/',
  '/about/',
  '/resume/',
  '/search/',
  '/privacy/',
];
test('E-NAV-01 E-404-01 all routes refresh and true404', async ({ page }) => {
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('h1'), route).toHaveCount(1);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex,nofollow');
  }
  const response = await page.goto('/definitely-not-a-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '这条路径，还没有作品。' })).toBeVisible();
});
test('E-NAV-02 A-02 mobile menu escape focus + skip and no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByText('跳转到正文')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  const menu = page.locator('.mobile-menu summary');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page
      .getByRole('navigation', { name: '移动主导航' })
      .getByRole('link', { name: '项目', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('E-THEME-01 three choices persistence and system follow', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('#theme-select')).toHaveValue('system');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    'dark',
  );
  await page.locator('#theme-select').selectOption('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    'light',
  );
  await page.reload();
  await expect(page.locator('#theme-select')).toHaveValue('light');
  await page.locator('#theme-select').selectOption('dark');
  expect(await page.evaluate(() => localStorage.getItem('jinquan-space:theme:v1'))).toBe('dark');
  await page.locator('#theme-select').selectOption('system');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    'light',
  );
});
test('E-SEARCH-01..03 IME hash loading failure retry XSS', async ({ page }) => {
  await page.goto('/search/');
  await page.locator('#search-query').dispatchEvent('compositionstart');
  await page.locator('#search-query').fill('时间差');
  await expect(page.locator('#search-status')).toHaveText('输入关键词，开始探索。');
  await page.locator('#search-query').dispatchEvent('compositionend');
  await expect(page.locator('#search-results article')).toHaveCount(3);
  await expect(page.locator('#search-results mark').first()).toHaveText('时间差');
  expect(decodeURIComponent(new URL(page.url()).hash)).toContain('时间差');
  await page.reload();
  await expect(page.locator('#search-results article')).toHaveCount(3);
  await page.locator('#search-query').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: '搜索 ↗', exact: true }).click();
  await expect(page.locator('#search-status')).toContainText('没有找到');
  await expect(page.locator('#search-results img')).toHaveCount(0);
  await page.getByRole('button', { name: '清空搜索' }).click();
  await expect(page.locator('#search-query')).toHaveValue('');
  await page.route('**/search-index.json', (r) => r.abort());
  await page.reload();
  await page.locator('#search-query').fill('FFT');
  await page.getByRole('button', { name: '搜索 ↗', exact: true }).click();
  await expect(page.locator('#search-retry')).toBeVisible();
  await page.unroute('**/search-index.json');
  await page.locator('#search-retry').click();
  await expect(page.locator('#search-results article').first()).toBeVisible();
});
test('project/article filters back-forward URLs', async ({ page }) => {
  await page.goto('/projects/');
  await page.getByRole('button', { name: '交互实验', exact: true }).click();
  await expect(page.locator('#filtered-content article:visible')).toHaveCount(1);
  await page.getByRole('button', { name: '数据处理', exact: true }).click();
  await expect(page.locator('#filtered-content article:visible')).toHaveCount(2);
  await page.goBack();
  await expect(page.locator('#filtered-content article:visible')).toHaveCount(1);
  await page.goto('/articles/?tag=FFT');
  await expect(page.locator('#filtered-content article:visible')).toHaveCount(1);
});
test('article TOC copy exact code and resume print pagination', async ({ page }) => {
  await page.goto('/articles/log-time-difference/');
  const toc = page.getByRole('navigation', { name: '本文目录' });
  await toc.getByRole('link', { name: '负差值提供了什么信息' }).click();
  expect(decodeURIComponent(new URL(page.url()).hash)).toContain('负差值');
  await expect(page.locator('.copy-button').first()).toBeVisible();
  const copyText = await page.locator('pre code').first().textContent();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.body.dataset.copied = value;
        },
      },
    });
  });
  await page.locator('.copy-button').first().click();
  await expect(page.locator('body')).toHaveAttribute('data-copied', copyText!);
  await page.goto('/resume/');
  await expect(page.getByRole('link', { name: '下载 PDF 简历' })).toHaveCount(0);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = 'yes';
    };
  });
  await page.locator('#print-resume').click();
  await expect(page.locator('body')).toHaveAttribute('data-printed', 'yes');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.resume-disclaimer')).toBeVisible();
  await expect(page.locator('.site-header')).not.toBeVisible();
  mkdirSync('test-results/print', { recursive: true });
  const shortPdf = await page.pdf({
    path: 'test-results/print/resume-short.pdf',
    format: 'A4',
    printBackground: true,
  });
  const shortHeight = await page
    .locator('.resume-page')
    .evaluate((e) => e.getBoundingClientRect().height);
  await page.evaluate(() => {
    const target = document.querySelector('.resume-page section')!;
    for (let i = 0; i < 12; i++) {
      const item = document.createElement('div');
      item.className = 'resume-item';
      const h = document.createElement('h3');
      h.textContent = `合成测试条目 ${i + 1}`;
      const p = document.createElement('p');
      p.textContent = '合成身份：用于验证中文打印分页、长内容自动换行与条目布局。'.repeat(3);
      item.append(h, p);
      target.append(item);
    }
  });
  expect(
    await page.locator('.resume-page').evaluate((e) => e.getBoundingClientRect().height),
  ).toBeGreaterThan(shortHeight);
  const longPdf = await page.pdf({
    path: 'test-results/print/resume-long.pdf',
    format: 'A4',
    printBackground: true,
  });
  // Chromium emits each printed page as an uncompressed /Type /Page object.
  // Compare pagination directly so this remains valid as the real resume grows.
  const pageCount = (pdf: Buffer) =>
    pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  expect(pageCount(shortPdf)).toBeGreaterThan(0);
  expect(pageCount(longPdf)).toBeGreaterThan(pageCount(shortPdf));
  writeFileSync(
    'test-results/print/note.txt',
    'Synthetic DOM entries only. No profile file was modified.',
  );
});
test('E-NOJS-01 navigation/static article/tool explanations', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL + '/');
  await expect(page.getByRole('heading', { name: /把想法做成/ })).toBeVisible();
  await page.locator('.mobile-menu summary').click();
  await expect(
    page.getByRole('navigation', { name: '移动主导航' }).getByRole('link', { name: '文章' }),
  ).toBeVisible();
  await page.goto(test.info().project.use.baseURL + '/tools/log-analyzer/');
  expect(await page.locator('noscript').textContent()).toContain('计算需要启用 JavaScript');
  await expect(page.locator('noscript p')).toBeVisible();
  await context.close();
});
