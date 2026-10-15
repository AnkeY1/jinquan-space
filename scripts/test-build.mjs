import { spawnSync } from 'node:child_process';
import { resolve, join, relative } from 'node:path';
import { mkdir, cp, symlink, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startServer } from './serve-static.mjs';
const root = process.cwd();
const astro = resolve('node_modules/astro/bin/astro.mjs');
const mode = process.argv[2];
function run(script, args = [], env = {}, cwd = root, expected = 0) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      SITE_MODE: 'preview',
      SITE_ORIGIN: '',
      SITE_BASE: '/',
      ASTRO_TELEMETRY_DISABLED: '1',
      ...env,
    },
  });
  if (r.status !== expected) {
    console.error(r.stdout, r.stderr);
    throw new Error(`${script} returned ${r.status}, expected ${expected}`);
  }
  return r;
}
async function allFiles(dir) {
  let out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    out.push(...(e.isDirectory() ? await allFiles(p) : [p]));
  }
  return out;
}
async function scan(dir, text, present) {
  const paths = await allFiles(dir);
  const found = [];
  for (const path of paths)
    if ((await readFile(path)).includes(Buffer.from(text))) found.push(relative(dir, path));
  assert.equal(found.length > 0, present, `${text} present=${found.join(',')}`);
}
if (mode === 'base') {
  const env = { SITE_BASE: '/portfolio/', BUILD_OUT_DIR: './.test-dist/base' };
  run(astro, ['build'], env);
  run(resolve('scripts/check-links.mjs'), [], env);
  run(resolve('scripts/check-bundle.mjs'), [], env);
  const server = await startServer({
    directory: '.test-dist/base',
    base: '/portfolio/',
    port: 4175,
  });
  let browser;
  try {
    browser = await chromium.launch({
      ...(process.platform === 'win32' &&
      existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
        ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }
        : {}),
    });
    const page = await browser.newPage();
    const prefix = 'http://127.0.0.1:4175/portfolio';
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const path of [
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
    ]) {
      assert.equal((await page.goto(prefix + path)).status(), 200);
      assert.equal(await page.locator('h1').count(), 1);
    }
    await page.goto(prefix + '/search/#q=' + encodeURIComponent('时间差'));
    await page.locator('#search-results article').first().waitFor();
    assert.equal(await page.locator('#search-results article').count(), 3);
    assert.ok(
      (await page.locator('#search-results a').first().getAttribute('href')).startsWith(
        '/portfolio/',
      ),
    );
    await page.goto(prefix + '/tools/log-analyzer/');
    await page.locator('#log-example').click();
    await page.locator('#log-export-a:enabled').waitFor();
    assert.ok((await page.locator('#log-stats-a').textContent()).includes('350'));
    const download = page.waitForEvent('download');
    await page.locator('#log-export-a').click();
    assert.equal((await download).suggestedFilename(), 'log-a-intervals.csv');
    await page.goto(prefix + '/tools/csv-plotter/');
    await page.locator('#csv-sample').click();
    await page.locator('#csv-export:enabled').waitFor();
    assert.ok((await page.locator('#csv-stats').textContent()).includes('温度'));
    await page.goto(prefix + '/lab/signal-studio/');
    await page.locator('#signal-export-time:enabled').waitFor();
    assert.equal((await page.goto(prefix + '/missing/')).status(), 404);
    assert.equal((await page.goto('http://127.0.0.1:4175/tools/')).status(), 404);
    assert.deepEqual(errors, []);
    console.log(
      'E-BASE-01: all routes, search, inline Workers, examples and download passed at /portfolio/',
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
} else if (mode === 'public') {
  const realProfilePath = resolve('src/data/profile.json');
  const realResumePath = resolve('src/data/resume.json');
  const originalProfileBytes = await readFile(realProfilePath);
  const originalResumeBytes = await readFile(realResumePath);
  const temporary = resolve('.test-dist/public-source');
  await mkdir(temporary, { recursive: true });
  // A verified task-local directory only. Real profile/resume data and normal dist are never modified.
  assert.ok(
    temporary.startsWith(resolve('.test-dist') + join('/').replaceAll('/', '\\')) ||
      temporary.startsWith(resolve('.test-dist') + '/'),
  );
  for (const name of [
    'src',
    'public',
    'scripts',
    'astro.config.mjs',
    'tsconfig.json',
    'package.json',
    'package-lock.json',
  ])
    await cp(resolve(name), join(temporary, name), { recursive: true, force: true });
  if (!existsSync(join(temporary, 'node_modules')))
    await symlink(
      resolve('node_modules'),
      join(temporary, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  const profilePath = join(temporary, 'src/data/profile.json');
  const profile = JSON.parse(await readFile(profilePath, 'utf8'));
  profile.displayName = '合成公开构建测试';
  profile.intro = '合成测试资料';
  profile.about = '合成测试资料';
  profile.wechatId = 'fixture_wechat';
  profile.hobbies = ['合成测试爱好'];
  const resumePath = join(temporary, 'src/data/resume.json');
  const fixtureResume = JSON.parse(await readFile(resumePath, 'utf8'));
  fixtureResume.summary = '合成测试履历';
  for (const field of ['education', 'experience', 'publications', 'patents', 'awards'])
    fixtureResume[field] = [];
  await writeFile(resumePath, JSON.stringify(fixtureResume));
  const fixture = (visibility, slug, sentinel) =>
    `---\nslug: ${slug}\ntitle: ${sentinel}\nsummary: 合成测试内容\ntags: [fixture]\nvisibility: ${visibility}\nkind: demo\npublishedAt: '2026-10-15'\nrelatedProjectSlugs: []\nreferences: []\n---\n\n## 合成测试\n\n${sentinel}\n`;
  await writeFile(
    join(temporary, 'src/content/articles/fixture-draft.md'),
    fixture('draft', 'fixture-draft', 'DRAFT_LEAK_SENTINEL_A19'),
  );
  await writeFile(
    join(temporary, 'src/content/articles/fixture-preview.md'),
    fixture('preview', 'fixture-preview', 'PREVIEW_ONLY_SENTINEL_A19'),
  );
  const env = { BUILD_OUT_DIR: './.test-dist/public' };
  profile.publicProfileApproved = false;
  await writeFile(profilePath, JSON.stringify(profile));
  const rejected = run(
    astro,
    ['build'],
    { ...env, SITE_MODE: 'public', SITE_ORIGIN: 'https://approved-fixture.test' },
    temporary,
    1,
  );
  assert.match(rejected.stdout + rejected.stderr, /尚未获站长批准/);
  run(astro, ['build'], env, temporary);
  const out = join(temporary, '.test-dist/public');
  await scan(out, 'DRAFT_LEAK_SENTINEL_A19', false);
  await scan(out, 'PREVIEW_ONLY_SENTINEL_A19', true);
  assert.equal(existsSync(join(out, 'sitemap.xml')), false);
  profile.publicProfileApproved = true;
  await writeFile(profilePath, JSON.stringify(profile));
  const publicEnv = {
    ...env,
    SITE_MODE: 'public',
    SITE_ORIGIN: 'https://approved-fixture.test',
    SITE_BASE: '/portfolio/',
  };
  run(astro, ['build'], publicEnv, temporary);
  await scan(out, 'DRAFT_LEAK_SENTINEL_A19', false);
  await scan(out, 'PREVIEW_ONLY_SENTINEL_A19', false);
  assert.equal(existsSync(join(out, 'articles/fixture-preview/index.html')), false);
  assert.equal(existsSync(join(out, 'sitemap.xml')), true);
  const home = await readFile(join(out, 'index.html'), 'utf8');
  assert.ok(home.includes('https://approved-fixture.test/portfolio/'));
  assert.match(home, /<meta name="robots" content="index,follow"/);
  for (const route of ['search', 'resume'])
    assert.match(await readFile(join(out, route, 'index.html'), 'utf8'), /noindex,nofollow/);
  const resume = await readFile(join(out, 'resume/index.html'), 'utf8');
  assert.match(resume, /资料模板：教育、任职与真实成果暂未填写/);
  assert.match(resume, /下列作品为本站演示项目/);
  assert.match(resume, /微信：fixture_wechat/);
  assert.doesNotMatch(resume, /当前为预览构建|尚未完成公开确认/);
  const about = await readFile(join(out, 'about/index.html'), 'utf8');
  assert.doesNotMatch(about, /当前为预览/);
  const privacy = await readFile(join(out, 'privacy/index.html'), 'utf8');
  assert.match(privacy, /当前为经站长授权的公开发布版本/);
  assert.doesNotMatch(privacy, /当前为预览构建/);
  const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');
  for (const forbidden of ['fixture-preview', 'fixture-draft', '/search/', '/resume/', '404.html'])
    assert.ok(!sitemap.includes(forbidden));
  run(resolve('scripts/check-links.mjs'), [], publicEnv, temporary);
  assert.deepEqual(await readFile(realProfilePath), originalProfileBytes);
  assert.deepEqual(await readFile(realResumePath), originalResumeBytes);
  console.log(
    'E-PUBLIC-01: approval gate, clean rebuild, draft/preview filtering, canonical, noindex, sitemap and real profile/resume unchanged passed',
  );
  const badPath = join(temporary, 'src/content/articles/fixture-invalid.md');
  const good = fixture('public', 'fixture-invalid', 'INVALID_FIXTURE');
  for (const [invalid, pattern] of [
    [good.replace('2026-10-15', '2026-02-30'), /日期/],
    [good.replace('slug: fixture-invalid', 'slug: Invalid Slug'), /slug/],
    [
      good.replace('relatedProjectSlugs: []', 'relatedProjectSlugs: [does-not-exist]'),
      /关联项目不存在/,
    ],
  ]) {
    await writeFile(badPath, invalid);
    const result = run(astro, ['build'], publicEnv, temporary, 1);
    assert.match(result.stdout + result.stderr, pattern);
  }
  await rm(badPath);
  console.log('U-CONTENT-03: invalid calendar date, slug and related project rejected');
  // Remove only the verified local node_modules junction; keep the isolated fixture directory for inspection.
  await rm(join(temporary, 'node_modules'), { force: true });
} else throw new Error('Choose base or public');
