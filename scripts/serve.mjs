import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
const root = process.cwd();
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf'};
http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.split('/').some(part => part.startsWith('.')) || path.startsWith('/backend/')) {res.writeHead(403); res.end('Forbidden'); return;}
    let file = resolve(root, '.' + path); if (file !== root && !file.startsWith(root + sep)) throw new Error('Path');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const content = await readFile(file); res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}); res.end(content);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4173, '127.0.0.1', () => console.log('Vidadental: http://127.0.0.1:4173'));
