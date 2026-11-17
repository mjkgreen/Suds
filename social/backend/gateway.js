// Local stand-in for a Supabase project's API host, for footage capture only.
//   /rest/v1/*     -> PostgREST (the app's real queries, RLS and RPCs)
//   /auth/v1/*     -> always the signed-in demo user (no passwords anywhere)
//   /storage/v1/*  -> files in social/backend/media (uploads kept in memory)
//   everything else -> harmless empty answers
// Usage: node gateway.js  (expects PostgREST on :3000)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { tokens, DEMO_USER } = require('./tokens');

const PORT = 54321, PGRST = 3000;
const MEDIA = path.join(__dirname, 'media');
// Stock photos/clips for seeded posts (see social/media), served as drink-media/stock/*.
const LIBRARY = path.join(__dirname, '..', 'media', 'library');
// Photos picked for the current post (social/media/pick.py), served as drink-media/run/*.
const RUN_MEDIA = path.join(__dirname, '..', 'out', 'media', 'run');

function session() {
  return { access_token: tokens.user, token_type: 'bearer', expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'demo-refresh', user: DEMO_USER };
}
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, ...cors });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
  'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (url.pathname.startsWith('/rest/v1/')) {
    const headers = { ...req.headers, host: `127.0.0.1:${PGRST}` };
    // A request with only the anon key acts as anon, like real Supabase.
    const p = http.request({ host: '127.0.0.1', port: PGRST, method: req.method,
      path: req.url.replace('/rest/v1', ''), headers }, (r) => {
      res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res);
    });
    p.on('error', (e) => send(res, 502, { message: e.message }));
    return req.pipe(p);
  }
  if (url.pathname.startsWith('/auth/v1/')) {
    if (url.pathname.endsWith('/user')) return send(res, 200, DEMO_USER);
    if (url.pathname.endsWith('/token')) return send(res, 200, session());
    if (url.pathname.endsWith('/logout')) return send(res, 204, '');
    return send(res, 200, {});
  }
  const pub = url.pathname.match(/^\/storage\/v1\/object\/public\/(.+)$/);
  if (pub) {
    const rel = decodeURIComponent(pub[1]).replace(/\.\./g, '');
    const f = rel.startsWith('drink-media/stock/') ? path.join(LIBRARY, rel.slice('drink-media/stock/'.length))
      : rel.startsWith('drink-media/run/') ? path.join(RUN_MEDIA, rel.slice('drink-media/run/'.length))
      : path.join(MEDIA, rel);
    if (fs.existsSync(f)) {
      const ext = path.extname(f).slice(1).toLowerCase();
      return send(res, 200, fs.readFileSync(f), { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4' }[ext] || 'application/octet-stream');
    }
    return send(res, 404, { message: 'not found' });
  }
  if (url.pathname.startsWith('/storage/v1/object/')) {
    req.resume(); return send(res, 200, { Key: url.pathname.split('/object/')[1] });
  }
  return send(res, 200, {});
}).listen(PORT, '127.0.0.1', () => console.log(`gateway on http://127.0.0.1:${PORT}`));
