import { defineConfig } from 'astro/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { unified } from '@astrojs/markdown-remark';
import safeMarkdown from './scripts/safe-markdown.mjs';
const profile = JSON.parse(
  readFileSync(new URL('./src/data/profile.json', import.meta.url), 'utf8'),
);
const mode = process.env.SITE_MODE || 'preview';
if (!['preview', 'public'].includes(mode)) throw new Error('SITE_MODE 仅支持 preview 或 public');
const rawBase = process.env.SITE_BASE || '/';
if (!/^\/[a-zA-Z0-9/_-]*\/?$/.test(rawBase) || rawBase.includes('//') || rawBase.includes('..'))
  throw new Error('SITE_BASE 必须是合法的站内路径');
const base =
  '/' +
  rawBase.split('/').filter(Boolean).join('/') +
  (rawBase.split('/').filter(Boolean).length ? '/' : '');
const origin = process.env.SITE_ORIGIN || '';
if (origin) {
  const u = new URL(origin);
  if (!['http:', 'https:'].includes(u.protocol) || u.origin !== origin || u.username || u.password)
    throw new Error('SITE_ORIGIN 只能包含 origin，不含路径或凭证');
}
if (mode === 'public') {
  if (
    !origin ||
    !origin.startsWith('https://') ||
    /localhost|127\.0\.0\.1|example\.|yourname|实际|填写|\{|\}/i.test(origin)
  )
    throw new Error('公开构建需要真实 HTTPS SITE_ORIGIN');
  if (profile.publicProfileApproved !== true)
    throw new Error('公开资料尚未获站长批准，不能公开构建');
}
if (
  profile.resumePdfPath &&
  (!/^\/files\/[\w.-]+\.pdf$/.test(profile.resumePdfPath) ||
    !existsSync(resolve('public', profile.resumePdfPath.slice(1))))
)
  throw new Error('简历 PDF 路径无效或文件不存在');
const out = process.env.BUILD_OUT_DIR || './dist';
if (!['./dist', './.test-dist/base', './.test-dist/public'].includes(out))
  throw new Error('构建目录必须位于指定项目输出目录');
export default defineConfig({
  output: 'static',
  ...(origin ? { site: origin } : {}),
  base,
  trailingSlash: 'always',
  outDir: out,
  devToolbar: { enabled: false },
  compressHTML: true,
  integrations: [
    {
      name: 'conditional-sitemap',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => {
          if (mode === 'public')
            injectRoute({ pattern: '/sitemap.xml', entrypoint: './src/endpoints/sitemap.ts' });
        },
      },
    },
  ],
  vite: { build: { license: true }, define: { __SITE_MODE__: JSON.stringify(mode) } },
  markdown: {
    processor: unified({ remarkPlugins: [[safeMarkdown, { base }]] }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
