// Local preview only. Production hosting serves dist/ directly.
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '../dist'));
const args = process.argv.slice(2);
const values = { '--host': '127.0.0.1', '--port': '4173' };
for (let i = 0; i < args.length; i += 2) {
  if (!(args[i] in values) || !args[i + 1]) throw new Error('用法：npm start -- --host 127.0.0.1 --port 4173');
  values[args[i]] = args[i + 1];
}
const host = values['--host'];
const port = Number(values['--port']);
if (!['127.0.0.1', '0.0.0.0'].includes(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('host 仅支持 127.0.0.1 或 0.0.0.0；port 必须是 1–65535 的整数。');
}
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
};
createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(root, '.' + path);
    if (file !== root && !file.startsWith(root + sep)) throw new Error('outside root');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    file = await realpath(file);
    if (!file.startsWith(root + sep)) throw new Error('outside root');
    const bytes = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Content-Length': bytes.length, 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('页面不存在');
  }
}).listen(port, host, () => {
  console.log(`本机预览：http://127.0.0.1:${port}/`);
  if (host === '0.0.0.0') console.log(`同一 Wi-Fi 手机预览：http://电脑局域网IP:${port}/（普通 HTTP，不支持完整离线安装）`);
});
