'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.wav': 'audio/wav',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
};

function inside(root, file) {
  const base = path.resolve(root);
  const abs = path.resolve(file);
  return abs === base || abs.startsWith(base + path.sep);
}

function startServer(root) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    let pathname = '/';
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
    } catch (e) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    if (pathname.includes('\0')) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const file = path.resolve(base, '.' + pathname);
    if (!inside(base, file)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    fs.stat(file, (err, st) => {
      if (err) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const target = st.isDirectory() ? path.join(file, 'index.html') : file;
      if (!inside(base, target)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(target, (readErr, buf) => {
        if (readErr) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': type,
          'Cache-Control': 'no-cache',
          'Content-Length': buf.length,
        });
        res.end(buf);
      });
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        url: 'http://127.0.0.1:' + port + '/',
      });
    });
  });
}

module.exports = { startServer, inside };
