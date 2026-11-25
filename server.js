'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const DATA_DIR = path.resolve(process.env.BLACKTOPS_APP_DATA_DIR || path.join(__dirname, '.data'));
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'guestbook.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
console.log('Database file:', DB_PATH);

const insert = db.prepare('INSERT INTO entries (name, message) VALUES (?, ?)');
const list = db.prepare('SELECT name, message, created_at FROM entries ORDER BY created_at DESC, id DESC');
const count = db.prepare('SELECT COUNT(*) AS n FROM entries');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

function page(error, name, message) {
  const items = list.all().map(e =>
    `<li><strong>${esc(e.name)}</strong> <time datetime="${esc(e.created_at)}">${esc(e.created_at.replace('T', ' ').replace(/\.\d+Z$/, ' UTC'))}</time><p>${esc(e.message)}</p></li>`
  ).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guestbook</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}input,textarea{width:100%;box-sizing:border-box;margin:.25rem 0 .75rem}.error{color:#b00020}ul{list-style:none;padding:0}li{border-bottom:1px solid #ddd;padding:.5rem 0}time{color:#666;font-size:.85em}p{white-space:pre-wrap;margin:.25rem 0}</style></head><body>
<h1>Guestbook</h1>
<form method="post" action="/">${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
<label>Name<input name="name" maxlength="50" required value="${esc(name || '')}"></label>
<label>Message<textarea name="message" maxlength="500" rows="4" required>${esc(message || '')}</textarea></label>
<button type="submit">Sign the guestbook</button></form>
<h2>Entries</h2><ul>${items || '<li>No entries yet.</li>'}</ul></body></html>`;
}

function send(res, code, body, type = 'text/html; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 20000) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, 'ok', 'text/plain');
    if (req.method === 'GET' && url.pathname === '/data-info') {
      return send(res, 200, `<!doctype html><meta charset="utf-8"><title>Data info</title><h1>Data info</h1><p>Database file: <code>${esc(DB_PATH)}</code></p><p>Entries: <strong>${count.get().n}</strong></p><p><a href="/">Back</a></p>`);
    }
    if (url.pathname === '/' && req.method === 'GET') return send(res, 200, page());
    if (url.pathname === '/' && req.method === 'POST') {
      const form = new URLSearchParams(await readBody(req));
      const name = (form.get('name') || '').trim();
      const message = (form.get('message') || '').trim();
      let error;
      if (!name || !message) error = 'Both name and message are required.';
      else if (name.length > 50) error = 'Name must be at most 50 characters.';
      else if (message.length > 500) error = 'Message must be at most 500 characters.';
      if (error) return send(res, 400, page(error, name, message));
      insert.run(name, message);
      res.writeHead(303, { Location: '/' });
      return res.end();
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) {
    console.error(e);
    send(res, 500, 'Server error', 'text/plain');
  }
});

server.listen(PORT, () => console.log('Guestbook listening on', PORT));
const stop = () => { server.close(); db.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
