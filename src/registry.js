import { calendarDay, readCounts } from './counts.js';
import { authenticated, credentials, login, logout, setup } from './auth.js';
import { adminJson, HttpError, readJson } from './http.js';

export function parseSite(data) {
  if (!data || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80
      || typeof data.url !== 'string' || data.url.length > 2048) {
    throw new HttpError(400, '사이트 이름(80자 이내)과 주소를 입력해주세요.');
  }
  let url;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(data.url.trim()) ? data.url.trim() : 'https://' + data.url.trim()); }
  catch { throw new HttpError(400, '사이트 주소를 확인해주세요.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname) {
    throw new HttpError(400, 'http 또는 https 사이트 주소를 입력해주세요.');
  }
  url.hash = '';
  return { name: data.name.trim(), url: url.href, origin: url.origin };
}

export function embedCode(site, base) {
  return `<small data-visitor-counter aria-live="polite">—</small>\n<script defer src="${base}/counter.js" data-site="${site.id}"></script>`;
}

export async function allowedSite(env, site, origin) {
  if (!site || !origin) return false;
  const registered = await env.DB.prepare('SELECT origin FROM registered_sites WHERE id=?').bind(site).first();
  if (registered) return registered.origin === origin;
  const legacy = JSON.parse(env.SITES || '{}');
  return Object.hasOwn(legacy, site) && Array.isArray(legacy[site]) && legacy[site].includes(origin);
}

export async function registryRoute(request, env) {
  const url = new URL(request.url);
  // Every state-changing request must originate from this admin page.
  if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) {
    throw new HttpError(403, '같은 관리 페이지에서 요청해주세요.');
  }
  if (url.pathname === '/api/session' && request.method === 'GET') {
    return adminJson({ authenticated: await authenticated(request, env),
      configured: Boolean(await credentials(env.DB)) });
  }
  if (url.pathname === '/api/setup' && request.method === 'POST') return setup(request, env);
  if (url.pathname === '/api/login' && request.method === 'POST') return login(request, env);
  if (!await authenticated(request, env)) throw new HttpError(401, '관리자 로그인이 필요합니다.');
  if (url.pathname === '/api/logout' && request.method === 'POST') return logout(request, env);
  if (url.pathname === '/api/sites' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM registered_sites ORDER BY created_at DESC, id').all();
    const sites = await Promise.all(results.map(async (site) => ({ ...site,
      code: embedCode(site, url.origin),
      counts: await readCounts(env.DB, { site: site.id, day: calendarDay(env.TIME_ZONE || 'Asia/Seoul') })
    })));
    return adminJson({ sites });
  }
  if (url.pathname === '/api/sites' && request.method === 'POST') {
    const site = { ...parseSite(await readJson(request)), id: 'site-' + crypto.randomUUID(), created_at: Date.now() };
    await env.DB.prepare('INSERT INTO registered_sites(id,name,url,origin,created_at) VALUES(?,?,?,?,?)')
      .bind(site.id, site.name, site.url, site.origin, site.created_at).run();
    return adminJson({ ...site, code: embedCode(site, url.origin) }, 201);
  }
  const match = url.pathname.match(/^\/api\/sites\/(site-[a-f0-9-]{36})$/);
  if (match && request.method === 'PUT') {
    const site = parseSite(await readJson(request));
    const existing = await env.DB.prepare('SELECT id FROM registered_sites WHERE id=?').bind(match[1]).first();
    if (!existing) throw new HttpError(404, '등록된 사이트가 없습니다.');
    await env.DB.prepare('UPDATE registered_sites SET name=?,url=?,origin=? WHERE id=?')
      .bind(site.name, site.url, site.origin, match[1]).run();
    return adminJson({ ok: true });
  }
  throw new HttpError(404, '요청을 찾을 수 없습니다.');
}
