import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { startServer } from './serve-static.mjs';
const r = spawnSync(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SITE_MODE: 'preview',
    SITE_BASE: '/',
    SITE_ORIGIN: '',
    ASTRO_TELEMETRY_DISABLED: '1',
  },
});
if (r.status !== 0) process.exit(r.status || 1);
const server = await startServer();
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => process.exit()));
