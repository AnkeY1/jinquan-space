import type { APIRoute } from 'astro';
import { content } from '../lib/content';
import { tools } from '../data/tools';
import { experiments } from '../data/experiments';
import type { SearchEntry } from '../lib/search';
export const prerender = true;
const clean = (value: string) =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[#*`>\[\]]/g, '')
    .slice(0, 8000);
export const GET: APIRoute = async () => {
  const { projects, articles } = await content();
  const entries: SearchEntry[] = [
    ...projects.map((p) => ({
      id: p.data.slug,
      type: 'project' as const,
      title: p.data.title,
      summary: p.data.summary,
      text: clean(p.body || ''),
      tags: p.data.tags,
      path: `/projects/${p.data.slug}/`,
    })),
    ...articles.map((a) => ({
      id: a.data.slug,
      type: 'article' as const,
      title: a.data.title,
      summary: a.data.summary,
      text: clean(a.body || ''),
      tags: a.data.tags,
      path: `/articles/${a.data.slug}/`,
    })),
    ...tools.map((t) => ({
      id: t.id,
      type: 'tool' as const,
      title: t.title,
      summary: t.summary,
      text: t.summary,
      tags: [...t.tags],
      path: t.path,
    })),
    ...experiments.map((e) => ({
      id: e.id,
      type: 'experiment' as const,
      title: e.title,
      summary: e.summary,
      text: e.summary,
      tags: [...e.tags],
      path: e.path,
    })),
  ];
  const json = JSON.stringify(entries);
  if (Buffer.byteLength(json) > 1024 * 1024) console.warn('搜索索引超过 1 MiB，请评估分片');
  return new Response(json, { headers: { 'Content-Type': 'application/json;charset=utf-8' } });
};
