import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const theme of ['light', 'dark'])
  for (const path of [
    '/',
    '/articles/log-time-difference/',
    '/tools/log-analyzer/',
    '/tools/csv-plotter/',
    '/lab/signal-studio/',
    '/resume/',
    '/search/',
  ])
    test(`A-01 ${theme} ${path}`, async ({ page }, testInfo) => {
      await page.goto(path);
      await page.locator('#theme-select').selectOption(theme);
      if (path === '/tools/log-analyzer/') {
        await page.locator('#log-example').click();
        await expect(page.locator('#log-status')).toContainText(/完成|成功/);
      }
      if (path === '/tools/csv-plotter/') {
        await page.locator('#csv-sample').click();
        await expect(page.locator('#csv-export')).toBeEnabled();
      }
      if (path === '/lab/signal-studio/')
        await expect(page.locator('#signal-status')).toContainText(/完成/);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      await testInfo.attach('axe.json', {
        body: JSON.stringify(result.violations, null, 2),
        contentType: 'application/json',
      });
      expect(
        result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    });
