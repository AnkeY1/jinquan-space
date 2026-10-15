import type { APIRoute } from 'astro';
import { toAbsoluteSiteUrl } from '../lib/url';
export const prerender = true;
export const GET: APIRoute = () =>
  new Response(
    'User-agent: *\nAllow: /\n' +
      (__SITE_MODE__ === 'public'
        ? `Sitemap: ${toAbsoluteSiteUrl('/sitemap.xml')}\n`
        : '# Preview pages use HTML noindex. This is not access control.\n'),
    { headers: { 'Content-Type': 'text/plain' } },
  );
