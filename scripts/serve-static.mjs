import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export function startServer({ directory = 'dist', base = '/', port = 4173 } = {}) {
  const root = resolve(directory);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.log': 'text/plain; charset=utf-8',
  };
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith(base) || !['GET', 'HEAD'].includes(req.method))
        throw new Error('not-found');
      const relative = pathname.slice(base.length);
      let path = resolve(root, relative || '.');
      if (path !== root && !path.startsWith(root + sep)) throw new Error('not-found');
      let info = await stat(path);
      if (info.isDirectory()) path = resolve(path, 'index.html');
      const data = await readFile(path);
      res.writeHead(200, {
        'content-type': types[extname(path)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      const page = await readFile(resolve(root, '404.html')).catch(() =>
        Buffer.from('404 Not Found'),
      );
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page);
    }
  });
  return new Promise((resolveServer) =>
    server.listen(port, '127.0.0.1', () => {
      console.log(`Static preview http://127.0.0.1:${port}${base}`);
      resolveServer(server);
    }),
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await startServer({
    directory: process.argv[2] || 'dist',
    base: process.argv[3] || '/',
    port: Number(process.argv[4] || 4173),
  });
