// Amulet Camera's private cloud. The linked phone sends each photo here as soon as it is kept.
//   PUT  /p/<id>/<part>        part = photo | cut | lens          X-Key
//   POST /sign/<id>            a link to the lens-size picture that Google Lens can open for an hour   X-Key
//   GET  /lens/<id>?e=&s=      that picture, signed, no key
//   GET  /list                 every object, for the Mac           X-Key
//   GET  /get/<id>/<part>      one object, for the Mac             X-Key
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', 'Access-Control-Allow-Headers': 'X-Key,X-Name,Content-Type' };
const ID = /^[0-9a-z-]{6,40}$/, PARTS = ['photo', 'cut', 'lens'];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (!a || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const u = new URL(req.url), p = u.pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && p[0] === 'lens' && ID.test(p[1] || '')) {
      const e = u.searchParams.get('e') || '', s = u.searchParams.get('s') || '';
      if (!(+e > Date.now() / 1000) || !same(s, await hmac(env.KEY, `lens/${p[1]}/${e}`))) return new Response('expired', { status: 403 });
      const o = await env.PHOTOS.get(`${p[1]}/lens`);
      if (!o) return new Response('not found', { status: 404 });
      return new Response(o.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=600' } });
    }

    if (!same(req.headers.get('X-Key'), env.KEY)) return json({ error: 'this phone is not linked' }, 401);

    if (req.method === 'PUT' && p[0] === 'p' && ID.test(p[1] || '') && PARTS.includes(p[2])) {
      const body = await req.arrayBuffer();
      if (!body.byteLength) return json({ error: 'empty' }, 400);
      await env.PHOTOS.put(`${p[1]}/${p[2]}`, body, {
        httpMetadata: { contentType: req.headers.get('Content-Type') || 'application/octet-stream' },
        customMetadata: { name: (req.headers.get('X-Name') || '').slice(0, 80) },
      });
      return json({ ok: true, bytes: body.byteLength });
    }

    if (req.method === 'POST' && p[0] === 'sign' && ID.test(p[1] || '')) {
      const e = Math.floor(Date.now() / 1000) + 3600;
      return json({ url: `${u.origin}/lens/${p[1]}?e=${e}&s=${await hmac(env.KEY, `lens/${p[1]}/${e}`)}` });
    }

    if (req.method === 'GET' && p[0] === 'list') {
      const out = []; let cursor;
      do {
        const r = await env.PHOTOS.list({ cursor, include: ['customMetadata', 'httpMetadata'] });
        for (const o of r.objects) out.push({ key: o.key, size: o.size, uploaded: o.uploaded, name: o.customMetadata?.name || '', type: o.httpMetadata?.contentType || '' });
        cursor = r.truncated ? r.cursor : null;
      } while (cursor);
      return json(out);
    }

    if (req.method === 'GET' && p[0] === 'get' && ID.test(p[1] || '') && PARTS.includes(p[2])) {
      const o = await env.PHOTOS.get(`${p[1]}/${p[2]}`);
      if (!o) return json({ error: 'not found' }, 404);
      return new Response(o.body, { headers: { ...CORS, 'Content-Type': o.httpMetadata?.contentType || 'application/octet-stream' } });
    }

    return json({ error: 'no such route' }, 404);
  },
};
