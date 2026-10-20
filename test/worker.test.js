import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../test-support/database.js';
import worker from '../src/worker.js';
import { calendarDay, countVisit, readCounts } from '../src/counts.js';
import { parseSite } from '../src/registry.js';
import { widget } from '../src/widget.js';
import { runInNewContext } from 'node:vm';

test('same-day deduplication, site isolation, new-day visit and retained totals', async () => {
  const db = database();
  const visit = { site: 'a', day: '2026-10-20', visitor: 'one' };
  await countVisit(db, visit);
  await countVisit(db, visit);
  await countVisit(db, { ...visit, visitor: 'two' });
  await countVisit(db, { ...visit, site: 'b' });
  assert.deepEqual(await readCounts(db, visit), {
    site: 'a', day: '2026-10-20', todayViews: 3, todayVisitors: 2,
    totalViews: 3, totalVisitorDays: 2
  });
  const tomorrow = { ...visit, day: '2026-10-21' };
  await countVisit(db, tomorrow);
  await db.prepare('DELETE FROM daily_visitors WHERE day < ?').bind(tomorrow.day).run();
  assert.equal((await readCounts(db, tomorrow)).totalVisitorDays, 3);
  assert.equal((await readCounts(db, tomorrow)).todayVisitors, 1);
  assert.equal((await readCounts(db, { ...visit, site: 'b' })).totalViews, 1);
});

test('Korean calendar boundary', () => {
  assert.equal(calendarDay('Asia/Seoul', new Date('2026-10-20T15:00:00Z')), '2026-10-21');
});

test('worker API validates origins, requests and does not count reads', async () => {
  const env = { DB: database(), SITES: '{"a":["https://a.example"]}', TIME_ZONE: 'Asia/Seoul' };
  const request = (method, body, origin = 'https://a.example') => new Request(
    'https://counter.example/v1/count?site=a', {
      method, headers: { Origin: origin, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body })
    });
  assert.equal((await worker.fetch(request('POST', '{}', 'https://evil.example'), env)).status, 403);
  assert.equal((await worker.fetch(request('POST', '{'), env)).status, 400);
  assert.equal((await worker.fetch(request('POST', '{}'), env)).status, 400);
  assert.equal((await worker.fetch(request('POST', 'x'.repeat(1025)), env)).status, 413);
  assert.equal((await worker.fetch(request('OPTIONS'), env)).status, 204);
  const body = JSON.stringify({ visitor: '00000000-0000-4000-8000-000000000001' });
  const first = await worker.fetch(request('POST', body), env);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('Access-Control-Allow-Origin'), 'https://a.example');
  await worker.fetch(request('POST', body), env);
  const counts = await (await worker.fetch(request('GET'), env)).json();
  assert.equal(counts.todayViews, 2);
  assert.equal(counts.todayVisitors, 1);
  assert.equal((await (await worker.fetch(request('GET'), env)).json()).totalViews, 2);
  assert.equal((await worker.fetch(new Request('https://counter.example/counter.js'), env)).status, 200);
});

test('web setup, login, registration, embed generation, edits and logout', async () => {
  const env = { DB: database(), TIME_ZONE: 'Asia/Seoul' };
  let cookie = '';
  const call = async (path, method = 'GET', body, origin = 'https://vc.hellojyp.com') => {
    const response = await worker.fetch(new Request('https://vc.hellojyp.com' + path, {
      method, headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }), env);
    return response;
  };
  assert.equal((await (await call('/api/session')).json()).configured, false);
  assert.equal((await call('/api/sites')).status, 401);
  assert.equal((await call('/api/setup', 'POST', { password: 'short' })).status, 400);
  const shortPassword = '123456789';
  assert.equal((await call('/api/setup', 'POST', { password: shortPassword, confirmPassword: shortPassword })).status, 400);
  const password = '1234567890';
  const setup = { password, confirmPassword: password };
  assert.equal((await call('/api/setup', 'POST', setup, 'https://evil.example')).status, 403);
  const created = await call('/api/setup', 'POST', setup);
  assert.equal(created.status, 200);
  cookie = created.headers.get('Set-Cookie').split(';')[0];
  assert.match(created.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Strict/);
  const stored = await env.DB.prepare('SELECT password_hash FROM admin_credentials').first();
  assert.notEqual(stored.password_hash, password);
  assert.equal((await call('/api/setup', 'POST', setup)).status, 409);
  assert.equal((await (await call('/api/session')).json()).authenticated, true);
  const register = await call('/api/sites', 'POST', { name: '점수판', url: '6nimmt.hellojyp.com' });
  assert.equal(register.status, 201);
  const site = await register.json();
  assert.equal(site.url, 'https://6nimmt.hellojyp.com/');
  assert.match(site.code, /src="https:\/\/vc.hellojyp.com\/counter.js"/);
  assert.ok(site.code.includes('data-site="' + site.id + '"'));
  assert.equal((await call('/v1/count?site=' + site.id, 'POST', {
    visitor: '00000000-0000-4000-8000-000000000001'
  }, site.origin)).status, 200);
  let listed = await (await call('/api/sites')).json();
  assert.equal(listed.sites[0].counts.todayVisitors, 1);
  assert.equal((await call('/api/sites/' + site.id, 'PUT', { name: 'New', url: 'https://new.example/path' })).status, 200);
  assert.equal((await call('/v1/count?site=' + site.id, 'GET', undefined, site.origin)).status, 403);
  assert.equal((await call('/v1/count?site=' + site.id, 'GET', undefined, 'https://new.example')).status, 200);
  listed = await (await call('/api/sites')).json();
  assert.equal(listed.sites[0].id, site.id);
  assert.equal(listed.sites[0].counts.todayVisitors, 1);
  assert.equal((await call('/api/logout', 'POST', {})).status, 200);
  assert.equal((await call('/api/sites')).status, 401);
  assert.equal((await call('/api/login', 'POST', { password: 'wrong' })).status, 403);
  const logged = await call('/api/login', 'POST', { password });
  assert.equal(logged.status, 200);
  cookie = logged.headers.get('Set-Cookie').split(';')[0];
  await env.DB.prepare('UPDATE admin_sessions SET expires_at=0').run();
  assert.equal((await call('/api/sites')).status, 401);
  assert.equal((await call('/')).headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal((await call('/admin.js')).status, 200);
});

test('setup can only be claimed once under concurrent requests', async () => {
  const env = { DB: database() };
  const setupRequest = () => new Request('https://vc.hellojyp.com/api/setup', {
    method: 'POST', headers: { Origin: 'https://vc.hellojyp.com', 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'test-password-2026', confirmPassword: 'test-password-2026' })
  });
  const responses = await Promise.all([worker.fetch(setupRequest(), env), worker.fetch(setupRequest(), env)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
});

test('registration rejects unsafe URLs and empty names', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'https://user:pass@example.com']) {
    assert.throws(() => parseSite({ name: 'site', url }));
  }
  assert.throws(() => parseSite({ name: ' ', url: 'https://example.com' }));
});

test('embedded widget submits a stable visitor ID and renders returned totals', async () => {
  const memory = new Map();
  const target = { textContent: '' };
  const requests = [];
  for (let run = 0; run < 2; run++) {
    await new Promise((resolve, reject) => {
      runInNewContext(widget, {
        URL, crypto: { getRandomValues: (bytes) => crypto.getRandomValues(bytes) },
        localStorage: { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) },
        CustomEvent: class { constructor(name, options) { this.detail = options.detail; } },
        document: {
          currentScript: { dataset: { site: 'test-site' }, src: 'https://vc.hellojyp.com/counter.js' },
          querySelector: () => target,
          dispatchEvent: (event) => { assert.equal(event.detail.todayVisitors, 2); resolve(); }
        },
        fetch: async (url, options) => {
          try {
            assert.equal(url.href, 'https://vc.hellojyp.com/v1/count?site=test-site');
            requests.push(JSON.parse(options.body));
            return { ok: true, json: async () => ({ todayVisitors: 2, totalVisitorDays: 12 }) };
          } catch (error) { reject(error); throw error; }
        }
      });
    });
  }
  assert.equal(requests[0].visitor, requests[1].visitor);
  assert.match(requests[0].visitor, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(target.textContent, 'Today 2 · Total 12');
});
