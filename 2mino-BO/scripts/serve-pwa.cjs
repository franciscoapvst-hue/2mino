// Servidor estático mínimo para dist/ — sin dependencias, para que el
// ícono de la PWA instalada tenga algo real escuchando en localhost:5174
// sin necesitar `npm run dev` abierto en una terminal.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 5174;
const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(DIST, urlPath);

    // Nunca servir fuera de dist/ (evita path traversal con "..")
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || stats.isDirectory()) {
        filePath = path.join(DIST, 'index.html'); // SPA fallback
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`2mino Back Office sirviendo dist/ en http://localhost:${PORT}`);
  });
