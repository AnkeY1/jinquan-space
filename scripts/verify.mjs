import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Use npm run verify');
for (const name of [
  'check',
  'lint',
  'format:check',
  'test:unit',
  'build',
  'test:e2e',
  'test:basepath',
  'test:public',
  'test:a11y',
  'test:links',
  'test:bundle',
]) {
  console.log(`\nVerification: ${name}`);
  const r = spawnSync(process.execPath, [resolve(npm), 'run', name], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status || 1);
}
