import { getCollection } from 'astro:content';
import { getVisibleContent } from './visibility';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
export async function content() {
  const projects = getVisibleContent(await getCollection('projects'));
  const articles = getVisibleContent(await getCollection('articles'));
  for (const p of projects) {
    if (
      p.data.cover &&
      (!/^\/images\/[A-Za-z0-9/_-]+\.(?:svg|png|jpg|jpeg|webp|avif)$/.test(p.data.cover) ||
        !existsSync(resolve('public', p.data.cover.slice(1))))
    )
      throw new Error(`项目封面路径无效或不存在：${p.data.cover}`);
  }
  for (const [items, name] of [
    [projects, 'projects'],
    [articles, 'articles'],
  ] as const) {
    const slugs = new Set<string>();
    for (const item of items) {
      if (slugs.has(item.data.slug)) throw new Error(`${name} slug 重复：${item.data.slug}`);
      slugs.add(item.data.slug);
    }
  }
  for (const p of projects)
    for (const slug of p.data.relatedArticleSlugs)
      if (!articles.some((a) => a.data.slug === slug))
        throw new Error(`项目关联文章不存在或不可见：${slug}`);
  for (const a of articles)
    for (const slug of a.data.relatedProjectSlugs)
      if (!projects.some((p) => p.data.slug === slug))
        throw new Error(`文章关联项目不存在或不可见：${slug}`);
  projects.sort(
    (a, b) =>
      (a.data.featuredOrder ?? 99) - (b.data.featuredOrder ?? 99) ||
      a.data.slug.localeCompare(b.data.slug),
  );
  articles.sort(
    (a, b) =>
      b.data.publishedAt.localeCompare(a.data.publishedAt) ||
      a.data.slug.localeCompare(b.data.slug),
  );
  return { projects, articles };
}
