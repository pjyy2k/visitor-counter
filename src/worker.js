import { calendarDay, countVisit, readCounts } from './counts.js';
import { widget } from './widget.js';

function json(data, status, origin) {
  return Response.json(data, { status, headers: {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  } });
}

async function route(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/counter.js' && request.method === 'GET') {
    return new Response(widget, { headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    } });
  }
  if (url.pathname === '/health' && request.method === 'GET') {
    return Response.json({ ok: true });
  }
  if (url.pathname !== '/v1/count') return json({ error: 'Not found' }, 404, 'null');
  const site = url.searchParams.get('site');
  const origin = request.headers.get('Origin');
  const sites = JSON.parse(env.SITES);
  if (!site || !Object.hasOwn(sites, site) || !Array.isArray(sites[site])
      || !origin || !sites[site].includes(origin)) {
    return json({ error: 'Site or origin not allowed' }, 403, 'null');
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', 'Vary': 'Origin'
    } });
  }
  if (!['POST', 'GET'].includes(request.method)) {
    return json({ error: 'Method not allowed' }, 405, origin);
  }
  const visit = { site, day: calendarDay(env.TIME_ZONE || 'Asia/Seoul') };
  if (request.method === 'POST') {
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
      return json({ error: 'Expected application/json' }, 415, origin);
    }
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Body required' }, 400, origin);
    let body = '';
    const decoder = new TextDecoder();
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return json({ error: 'Body too large' }, 413, origin);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    let data;
    try { data = JSON.parse(body); }
    catch { return json({ error: 'Invalid JSON' }, 400, origin); }
    if (!data || typeof data.visitor !== 'string'
        || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.visitor)) {
      return json({ error: 'visitor must be a UUID v4' }, 400, origin);
    }
    await countVisit(env.DB, { ...visit, visitor: data.visitor.toLowerCase() });
  }
  return json(await readCounts(env.DB, visit), 200, origin);
}

export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch { return json({ error: 'Service unavailable' }, 503, request.headers.get('Origin') || 'null'); }
  },
  async scheduled(_event, env) {
    // Yesterday's IDs are no longer needed. Aggregate counts are retained.
    await env.DB.prepare('DELETE FROM daily_visitors WHERE day < ?')
      .bind(calendarDay(env.TIME_ZONE || 'Asia/Seoul')).run();
  }
};
