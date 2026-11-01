// Local-only static preview, including a subpath to check gateway hosting.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

export function createPreview() {
  return createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      if (pathname === '/' || pathname === '/preview') {
        res.writeHead(302, { Location: '/preview/' });
        res.end();
        return;
      }
      if (!pathname.startsWith('/preview/')) throw new Error('Not found');
      const path = resolve(root, `.${pathname.slice('/preview'.length)}${pathname.endsWith('/') ? 'index.html' : ''}`);
      if (!path.startsWith(resolve(root) + sep)) throw new Error('Not found');
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use a port between 1 and 65535.');
  const server = createPreview();
  server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/preview/`));
}
