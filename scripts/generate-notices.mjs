import { readFile, readdir, writeFile } from 'node:fs/promises';
let notice =
  'THIRD-PARTY CLIENT RUNTIME NOTICES\n\nOriginal site code and content license is to be decided by the site owner.\nThe following notices apply to third-party client runtime dependencies only.\n';
for (const name of ['echarts', 'zrender', 'tslib', 'papaparse']) {
  const root = `node_modules/${name}`;
  const info = JSON.parse(await readFile(`${root}/package.json`, 'utf8'));
  notice += `\n${'='.repeat(70)}\n${name} ${info.version} (${info.license})\n${typeof info.repository === 'object' ? info.repository.url : info.repository}\n`;
  for (const entry of (await readdir(root, { withFileTypes: true })).filter((f) =>
    /^(?:license|notice|copyright)/i.test(f.name),
  )) {
    if (entry.isDirectory()) {
      for (const child of await readdir(`${root}/${entry.name}`))
        notice += `\n--- ${entry.name}/${child} ---\n${await readFile(`${root}/${entry.name}/${child}`, 'utf8')}\n`;
    } else
      notice += `\n--- ${entry.name} ---\n${await readFile(`${root}/${entry.name}`, 'utf8')}\n`;
  }
}
await writeFile('public/third-party-notices.txt', notice);
console.log('Client license and NOTICE texts retained in public/third-party-notices.txt');
