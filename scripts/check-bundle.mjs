import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
const root = resolve(process.env.BUILD_OUT_DIR || 'dist'),
  base = process.env.SITE_BASE || '/';
async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    out.push(...(e.isDirectory() ? await files(p) : [p]));
  }
  return out;
}
const all = await files(root);
const sizes = new Map();
let total = 0;
for (const f of all) {
  const b = await readFile(f);
  total += b.length;
  sizes.set(f, { raw: b.length, gzip: gzipSync(b).length });
}
async function graph(file, seen) {
  if (seen.has(file)) return;
  seen.add(file);
  const content = await readFile(file, 'utf8');
  for (const m of content.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'`](\.[^"'`]+\.js)["'`]/g,
  )) {
    await graph(resolve(dirname(file), m[1]), seen);
  }
}
const report = [];
for (const f of all.filter((f) => f.endsWith('.html'))) {
  const html = await readFile(f, 'utf8');
  const js = new Set(),
    css = new Set();
  for (const m of html.matchAll(/<script[^>]*src="([^"]+)"/g)) {
    const target = resolve(root, m[1].slice(base.length));
    await graph(target, js);
  }
  for (const m of html.matchAll(/<link[^>]*href="([^"]+\.css)"/g))
    css.add(resolve(root, m[1].slice(base.length)));
  const inline = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join('\n');
  const jsBytes =
    [...js].reduce((n, p) => n + sizes.get(p).gzip, 0) + (inline ? gzipSync(inline).length : 0);
  const cssBytes = [...css].reduce((n, p) => n + sizes.get(p).gzip, 0);
  const route = relative(root, f).replaceAll('\\', '/');
  const tool = /^(?:tools\/(?:log-analyzer|csv-plotter)|lab\/signal-studio)\//.test(route);
  report.push({
    route,
    jsGzipKiB: Number((jsBytes / 1024).toFixed(2)),
    cssGzipKiB: Number((cssBytes / 1024).toFixed(2)),
    jsBudgetKiB: tool ? 450 : 90,
    pass: jsBytes <= (tool ? 450 : 90) * 1024 && cssBytes <= 45 * 1024,
  });
}
console.table(report);
console.log(`Static total ${(total / 1024 / 1024).toFixed(2)} MiB; ${all.length} files`);
if (process.env.BUILD_OUT_DIR === undefined) {
  await mkdir('docs/evidence', { recursive: true });
  await writeFile(
    'docs/evidence/bundle.json',
    JSON.stringify({ totalBytes: total, report }, null, 2) + '\n',
  );
}
if (total > 20 * 1024 * 1024 || report.some((r) => !r.pass)) process.exit(1);
