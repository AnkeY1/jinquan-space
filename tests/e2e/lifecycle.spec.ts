import { test, expect } from '@playwright/test';
test('P-02 repeated log analysis releases workers and charts', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const NativeWorker = Worker;
    const state = { active: 0, created: 0 };
    Object.defineProperty(window, 'workerAudit', { value: state });
    window.Worker = class extends NativeWorker {
      private stopped = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        state.active++;
        state.created++;
      }
      terminate() {
        super.terminate();
        if (!this.stopped) {
          state.active--;
          this.stopped = true;
        }
      }
    };
  });
  await page.goto('/tools/log-analyzer/');
  const measurements = [];
  for (let i = 0; i < 10; i++) {
    await page.locator('#log-example').click();
    await expect(page.locator('#log-export-a')).toBeEnabled();
    await expect(page.locator('#log-status')).toContainText(/完成/);
    expect(await page.locator('canvas').count()).toBe(3);
    const counters = await page.evaluate(
      () => (window as unknown as { workerAudit: { active: number; created: number } }).workerAudit,
    );
    expect(counters.active).toBe(0);
    measurements.push({ ...counters, iteration: i + 1 });
    await page.locator('#log-clear').click();
    expect(await page.locator('canvas').count()).toBe(0);
  }
  expect(measurements.at(-1)!.created).toBe(10);
  await testInfo.attach('worker-lifecycle.json', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  });
});
