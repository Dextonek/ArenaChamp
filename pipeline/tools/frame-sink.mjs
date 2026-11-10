// A sink for frames filmed in the browser (pipeline/tools/clip-film.js): PUT /<name> writes the body to
// <folder>/<name> (default: a "cap" folder next to where it is run). Local only (127.0.0.1:5199); ends by
// itself after 9 minutes or on GET /quit.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// usage: node pipeline/tools/frame-sink.mjs [folder]
const dir = path.resolve(process.argv[2] ?? 'cap');
fs.mkdirSync(dir, { recursive: true });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'PUT, GET, OPTIONS', 'Access-Control-Allow-Headers': '*' };
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (req.url === '/quit') { res.writeHead(200, cors); res.end('bye'); server.close(); setTimeout(() => process.exit(0), 100); return; }
  if (req.method !== 'PUT') { res.writeHead(200, cors); res.end('sink'); return; }
  const name = decodeURIComponent(req.url.slice(1)).replace(/[^A-Za-z0-9_.-]/g, '_');
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => { fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks)); res.writeHead(200, cors); res.end('ok'); });
});
server.listen(5199, '127.0.0.1', () => console.log('sink on 5199, pid', process.pid));
setTimeout(() => process.exit(0), 9 * 60 * 1000);
