import type { APIRoute } from 'astro';
import { content } from '../lib/content';
import { toAbsoluteSiteUrl } from '../lib/url';
export const prerender = true;
const xml = (v: string) =>
  v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export const GET: APIRoute = async () => {
  const { projects, articles } = await content();
  const paths = [
    '/',
    '/projects/',
    '/articles/',
    '/tools/',
    '/tools/log-analyzer/',
    '/tools/csv-plotter/',
    '/lab/',
    '/lab/signal-studio/',
    '/about/',
    '/privacy/',
    ...projects.map((p) => `/projects/${p.data.slug}/`),
    ...articles.map((a) => `/articles/${a.data.slug}/`),
  ];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    paths.map((p) => `<url><loc>${xml(toAbsoluteSiteUrl(p)!)}</loc></url>`).join('') +
    '</urlset>';
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
