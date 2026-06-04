/* Pilote Olfacode — Lanceur autonome (zéro dépendance externe)
 * Usage : node launch.js
 * Ouvre l'app dans le navigateur sur http://localhost:8765 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 8765;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.md':   'text/markdown; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(req.url.split('?')[0]);
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const filePath = path.join(ROOT, pathname);
  // Empêche traversée hors du dossier
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found : ' + pathname);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, must-revalidate'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('');
  console.log('  ╔════════════════════════════════════════════╗');
  console.log('  ║  🎯  PILOTE OLFACODE — Assistant CEO       ║');
  console.log('  ╠════════════════════════════════════════════╣');
  console.log(`  ║  ▸ Ouvert sur : ${url.padEnd(26)} ║`);
  console.log('  ║  ▸ Ctrl+C pour arrêter                     ║');
  console.log('  ╚════════════════════════════════════════════╝');
  console.log('');
  // Ouvre automatiquement le navigateur
  const opener = process.platform === 'win32' ? `start ${url}`
              : process.platform === 'darwin' ? `open ${url}`
              : `xdg-open ${url}`;
  exec(opener, (err) => { if (err) console.log('Ouvre manuellement :', url); });
});

process.on('SIGINT', () => {
  console.log('\nAu revoir Tancia. À demain.');
  process.exit(0);
});
