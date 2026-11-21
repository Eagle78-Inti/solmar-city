// serve.ts — tiny static dev server for Solmar City.
// Run with Node 22: `node serve.ts` (serves the repo root on :8080),
// or `node serve.ts 3000` for another port. Stdlib only, no network
// access beyond the local socket; the game itself loads no remote assets.
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = process.cwd();
const PORT = parseInt(process.argv[2] || '8080', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

function safeJoin(root, rel) {
  const p = path.resolve(root, rel);
  if (!p.startsWith(path.resolve(root))) return null;
  return p;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, game: 'Solmar City' }));
    return;
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/game/index.html';
  const file = safeJoin(ROOT, '.' + rel);
  if (!file) { res.writeHead(403); res.end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Solmar City dev server: http://localhost:${PORT}/`);
  console.log(`Serving ${ROOT}`);
});

// Health-check route helper (kept tiny on purpose).
export function healthPath() { return '/'; }
