import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import { DatabaseSync } from 'node:sqlite';

const MAX_BODY_BYTES = 1024;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,15}$/u;
const PLAYER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function send(res, status, value, origin) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': status === 200 ? 'public, max-age=10' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {})
  });
  res.end(body);
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain'
};

function serveStatic(req, res, root, pathname) {
  if (!root || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { res.writeHead(400); res.end(); return true; }
  const base = resolve(root);
  const target = resolve(base, '.' + decoded);
  if (target !== base && !target.startsWith(base + sep)) {
    res.writeHead(403); res.end(); return true;
  }
  let file = target;
  let stats;
  try {
    stats = statSync(file);
    if (stats.isDirectory()) { file = resolve(file, 'index.html'); stats = statSync(file); }
  } catch {
    res.writeHead(404); res.end(); return true;
  }
  if (!stats.isFile()) { res.writeHead(404); res.end(); return true; }
  const type = extname(file);
  const textual = ['.html', '.js', '.css', '.json', '.svg', '.txt'].includes(type);
  let start = 0;
  let end = stats.size - 1;
  const range = req.headers.range;
  if (range && /^(?:bytes=)[0-9]*-[0-9]*$/.test(range)) {
    const [first, last] = range.slice(6).split('-');
    start = first ? Number(first) : Math.max(0, stats.size - Number(last));
    end = first && last ? Math.min(Number(last), end) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stats.size) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + stats.size }); res.end(); return true;
    }
  }
  const partial = Boolean(range && /^(?:bytes=)[0-9]*-[0-9]*$/.test(range));
  res.writeHead(partial ? 206 : 200, {
    'Content-Type': (MIME[type] || 'application/octet-stream') + (textual ? '; charset=utf-8' : ''),
    'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes',
    ...(partial ? { 'Content-Range': 'bytes ' + start + '-' + end + '/' + stats.size } : {}),
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff'
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file, { start, end }).pipe(res);
  return true;
}

async function readBody(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) {
      const error = new Error('Pedido muito grande.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('JSON inválido.');
    error.status = 400;
    throw error;
  }
}

function validatedSubmission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { playerId, name, score, durationMs } = body;
  if (typeof playerId !== 'string' || !PLAYER_ID_RE.test(playerId)) return null;
  if (typeof name !== 'string') return null;
  const displayName = name.trim().replace(/\s+/gu, ' ');
  if (!NAME_RE.test(displayName)) return null;
  if (!Number.isSafeInteger(score) || score < 1 || score > 1_000_000_000) return null;
  if (!Number.isSafeInteger(durationMs) || durationMs < 15_000 || durationMs > 4 * 60 * 60 * 1000) return null;
  return { playerId: playerId.toLowerCase(), name: displayName, score, durationMs };
}

export function createLeaderboardServer({
  databasePath = ':memory:',
  siteRoot,
  allowedOrigins = ['https://superfekagaps.torbware.space'],
  now = () => Date.now()
} = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS scores (
      player_id_hash TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS scores_order
      ON scores (score DESC, duration_ms ASC, updated_at ASC);
  `);

  const top = database.prepare(
    'SELECT name, score, duration_ms AS durationMs FROM scores ' +
    'ORDER BY score DESC, duration_ms ASC, updated_at ASC LIMIT 10'
  );
  const upsert = database.prepare(`
    INSERT INTO scores (player_id_hash, name, score, duration_ms, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(player_id_hash) DO UPDATE SET
      name = excluded.name,
      score = excluded.score,
      duration_ms = excluded.duration_ms,
      updated_at = excluded.updated_at
    WHERE excluded.score > scores.score
       OR (excluded.score = scores.score AND excluded.duration_ms < scores.duration_ms)
  `);
  const writeLimits = new Map();
  const originSet = new Set(allowedOrigins);
  let lastSweep = 0;

  function limited(ip) {
    const at = now();
    if (at - lastSweep > 60_000) {
      for (const [key, value] of writeLimits) {
        if (at - value.since >= 3_600_000) writeLimits.delete(key);
      }
      lastSweep = at;
    }
    const previous = writeLimits.get(ip);
    const current = !previous || at - previous.since >= 3_600_000
      ? { since: at, count: 0 } : previous;
    current.count++;
    writeLimits.set(ip, current);
    return current.count > 20;
  }

  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const acceptedOrigin = origin && originSet.has(origin) ? origin : undefined;
    let path;
    try { path = new URL(req.url || '/', 'http://localhost').pathname; }
    catch { send(res, 400, { error: 'URL inválida.' }, acceptedOrigin); return; }

    if (req.method === 'GET' && path === '/healthz') {
      send(res, 200, { ok: true }, acceptedOrigin);
      return;
    }
    if (path !== '/api/leaderboard') {
      if (serveStatic(req, res, siteRoot, path)) return;
      send(res, 404, { error: 'Rota não encontrada.' }, acceptedOrigin);
      return;
    }
    if (req.method === 'OPTIONS') {
      if (!acceptedOrigin) {
        send(res, 403, { error: 'Origem não permitida.' });
        return;
      }
      res.writeHead(204, {
        'Access-Control-Allow-Origin': acceptedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
        'Vary': 'Origin'
      });
      res.end();
      return;
    }
    if (req.method === 'GET') {
      const entries = top.all().map((entry, index) => ({ rank: index + 1, ...entry }));
      send(res, 200, { entries }, acceptedOrigin);
      return;
    }
    if (req.method !== 'POST') {
      send(res, 405, { error: 'Método não permitido.' }, acceptedOrigin);
      return;
    }
    if (origin && !acceptedOrigin) {
      send(res, 403, { error: 'Origem não permitida.' });
      return;
    }
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
      send(res, 415, { error: 'Envie JSON.' }, acceptedOrigin);
      return;
    }
    // The backend is reachable only through the Oracle host's Caddy proxy.
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const cloudflareIp = String(req.headers['cf-connecting-ip'] || '').trim();
    const ip = req.socket.remoteAddress?.startsWith('172.19.')
      ? (isIP(cloudflareIp) ? cloudflareIp : isIP(forwarded) ? forwarded : req.socket.remoteAddress)
      : req.socket.remoteAddress || 'unknown';
    if (limited(ip)) {
      send(res, 429, { error: 'Muitas tentativas. Tente mais tarde.' }, acceptedOrigin);
      return;
    }
    try {
      const submission = validatedSubmission(await readBody(req));
      if (!submission) {
        send(res, 400, { error: 'Nome, pontuação ou tempo inválido.' }, acceptedOrigin);
        return;
      }
      const playerHash = createHash('sha256').update(submission.playerId).digest('hex');
      const result = upsert.run(
        playerHash, submission.name, submission.score, submission.durationMs, now()
      );
      send(res, 200, { saved: result.changes > 0, entries: top.all().map((entry, index) => ({
        rank: index + 1, ...entry
      })) }, acceptedOrigin);
    } catch (error) {
      if (error.status) {
        send(res, error.status, { error: error.message }, acceptedOrigin);
      } else {
        console.error('scoreboard request failed', error);
        send(res, 500, { error: 'Erro ao salvar pontuação.' }, acceptedOrigin);
      }
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.on('close', () => database.close());
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createLeaderboardServer({
    databasePath: process.env.SFG_SCORE_DB || './data/scores.sqlite',
    siteRoot: process.env.SFG_SITE_ROOT,
    allowedOrigins: (process.env.SFG_ALLOWED_ORIGINS ||
      'https://superfekagaps.torbware.space,http://localhost:3000,http://localhost:5173'
    ).split(',').map(value => value.trim()).filter(Boolean)
  });
  const port = Number(process.env.SFG_SCORE_PORT || 8787);
  const host = process.env.SFG_SCORE_HOST || '127.0.0.1';
  server.listen(port, host, () => console.log('SFG scoreboard listening on ' + host + ':' + port));
  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
}
