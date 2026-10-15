import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const browser = await chromium.launch({
  ...(process.platform === 'win32' &&
  existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }
    : {}),
});
const page = await browser.newPage({ reducedMotion: 'reduce' });
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4321';
await mkdir('docs/evidence', { recursive: true });
for (const [width, height] of [
  [1440, 1000],
  [1366, 768],
  [390, 844],
  [320, 800],
])
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + '/');
    await page.locator('#theme-select').selectOption(theme);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/evidence/home-${width}-${theme}.png`, fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error(`Home overflow ${width}`);
  }
for (const [slug, path] of [
  ['article', '/articles/log-time-difference/'],
  ['project', '/projects/log-analyzer/'],
])
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ])
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height });
      await page.goto(origin + path);
      await page.locator('#theme-select').selectOption(theme);
      await page.screenshot({
        path: `docs/evidence/${slug}-${width}-${theme}.png`,
        fullPage: true,
      });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw new Error(`${slug} overflow ${width}`);
    }
await page.goto(origin + '/');
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('.mobile-menu summary').click();
await page.screenshot({ path: 'docs/evidence/mobile-menu.png' });
console.log(`Visual captures complete; ${browser.version()}`);
await browser.close();
