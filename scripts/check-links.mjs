import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const root = resolve(process.env.BUILD_OUT_DIR || 'dist');
const base = process.env.SITE_BASE || '/';
let references = 0;
const errors = [];
async function files(dir) {
  const output = [];
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, f.name);
    if (f.isDirectory()) output.push(...(await files(path)));
    else output.push(path);
  }
  return output;
}
const paths = await files(root);
const cache = new Map();
async function html(path) {
  if (!cache.has(path)) cache.set(path, await readFile(path, 'utf8'));
  return cache.get(path);
}
async function check(raw, source) {
  if (!raw || /^(?:https?:|mailto:|data:|blob:)/i.test(raw)) return;
  references++;
  let url;
  try {
    url = new URL(
      raw.replaceAll('&amp;', '&'),
      'https://local.invalid' + base + relative(root, source).replaceAll('\\', '/'),
    );
  } catch {
    errors.push(`${relative(root, source)} invalid URL ${raw}`);
    return;
  }
  if (url.origin !== 'https://local.invalid') {
    errors.push(`Untrusted protocol ${raw}`);
    return;
  }
  if (!url.pathname.startsWith(base)) {
    errors.push(`Lost base ${raw} in ${relative(root, source)}`);
    return;
  }
  let target = resolve(root, decodeURIComponent(url.pathname.slice(base.length)));
  try {
    if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
    await stat(target);
  } catch {
    errors.push(`Missing ${raw} from ${relative(root, source)}`);
    return;
  }
  if (url.hash && target.endsWith('.html')) {
    const id = decodeURIComponent(url.hash.slice(1));
    const text = await html(target);
    if (![...text.matchAll(/\bid=["']([^"']+)["']/g)].some((m) => m[1] === id))
      errors.push(`Missing anchor ${raw} from ${relative(root, source)}`);
  }
}
for (const path of paths) {
  if (path.endsWith('.html')) {
    const text = await html(path);
    for (const tag of text.matchAll(/<[a-zA-Z][^>]*>/g))
      for (const attr of tag[0].matchAll(/\s(?:href|src)=["']([^"']+)["']/g))
        await check(attr[1], path);
  }
  if (path.endsWith('.js')) {
    const text = await readFile(path, 'utf8');
    for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.[^"']+)["']/g))
      await check(m[1], path);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Links OK: ${references} references, ${cache.size} HTML pages, base ${base}`);
