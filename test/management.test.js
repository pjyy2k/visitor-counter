import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { database } from '../test-support/database.js';
import { readHistory } from '../src/history.js';
import { countVisit } from '../src/counts.js';
import { adminClient } from '../src/admin-client.js';
import { Script } from 'node:vm';

async function harness() {
  const env = { DB: database(), TIME_ZONE: 'Asia/Seoul' };
  let cookie = '';
  const call = (path, options = {}) => worker.fetch(new Request('https://vc.hellojyp.com' + path, {
    method: options.method || 'GET', headers: { Origin: options.origin || 'https://vc.hellojyp.com',
      Cookie: options.cookie ?? cookie, 'Content-Type': 'application/json' },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
  }), env);
  const setup = await call('/api/setup', { method: 'POST', body: { password: '1234567890', confirmPassword: '1234567890' } });
  cookie = setup.headers.get('Set-Cookie').split(';')[0];
  return { env, call, cookie };
}

test('password rotation validates current password and invalidates every old session', async () => {
  const { env, call, cookie } = await harness();
  const second = await call('/api/login', { method: 'POST', body: { password: '1234567890' } });
  const secondCookie = second.headers.get('Set-Cookie').split(';')[0];
  const change = { currentPassword: 'bad', password: 'new-password-123', confirmPassword: 'new-password-123' };
  assert.equal((await call('/api/password', { method: 'POST', body: change })).status, 403);
  assert.equal((await call('/api/password', { method: 'POST', body: { ...change, currentPassword: '1234567890', confirmPassword: 'mismatch' } })).status, 400);
  change.currentPassword = '1234567890';
  const result = await call('/api/password', { method: 'POST', body: change });
  assert.equal(result.status, 200);
  for (const oldCookie of [cookie, secondCookie]) {
    assert.equal((await call('/api/sites', { cookie: oldCookie })).status, 401);
  }
  assert.equal((await call('/api/login', { method: 'POST', body: { password: '1234567890' } })).status, 403);
  assert.equal((await call('/api/login', { method: 'POST', body: { password: change.password } })).status, 200);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_sessions').first()).n, 1);
});

test('disabled sites stop collection, preserve history and resume using the same code', async () => {
  const { call } = await harness();
  const site = await (await call('/api/sites', { method: 'POST', body: { name: 'test', url: 'https://example.com/page' } })).json();
  let listed = await (await call('/api/sites')).json();
  assert.equal(listed.sites[0].last_seen_at, null);
  const visit = { method: 'POST', origin: site.origin, body: { visitor: '00000000-0000-4000-8000-000000000001' } };
  assert.equal((await call('/v1/count?site=' + site.id, visit)).status, 200);
  listed = await (await call('/api/sites')).json();
  const seen = listed.sites[0].last_seen_at;
  assert.ok(seen > 0);
  assert.equal((await call('/api/sites/' + site.id + '/active', { method: 'PUT', body: { active: 'false' } })).status, 400);
  assert.equal((await call('/api/sites/' + site.id + '/active', { method: 'PUT', body: { active: false } })).status, 200);
  assert.equal((await call('/v1/count?site=' + site.id, visit)).status, 403);
  const history = await (await call('/api/sites/' + site.id + '/history?days=7')).json();
  assert.equal(history.history.length, 7);
  assert.equal(history.history.reduce((sum, row) => sum + row.views, 0), 1);
  listed = await (await call('/api/sites')).json();
  assert.equal(listed.sites[0].last_seen_at, seen);
  assert.equal(listed.sites[0].code, site.code);
  await call('/api/sites/' + site.id + '/active', { method: 'PUT', body: { active: true } });
  assert.equal((await call('/v1/count?site=' + site.id, visit)).status, 200);
  assert.equal((await (await call('/api/sites')).json()).sites[0].counts.totalViews, 2);
  assert.equal((await call('/api/sites/' + site.id + '/history?days=999')).status, 400);
  assert.equal((await call('/api/sites/' + site.id + '/history?days=30', { cookie: '' })).status, 401);
});

test('history zero-fills absent days, isolates sites, and handles Korean month boundaries', async () => {
  const db = database();
  await countVisit(db, { site: 'a', day: '2026-01-31', visitor: 'one' });
  await countVisit(db, { site: 'b', day: '2026-01-31', visitor: 'one' });
  await countVisit(db, { site: 'a', day: '2026-02-02', visitor: 'one' });
  const rows = await readHistory(db, { site: 'a', days: 7, timeZone: 'Asia/Seoul', now: new Date('2026-01-31T15:00:00Z') });
  assert.equal(rows[0].day, '2026-01-26');
  assert.deepEqual(rows.at(-1), { day: '2026-02-01', views: 0, visitors: 0 });
  assert.equal(rows.reduce((sum, row) => sum + row.visitors, 0), 1);
  assert.equal((await readHistory(db, { site: 'a', days: 30, now: new Date('2026-02-01T00:00:00Z') })).length, 30);
});

test('admin script including lazy history chart parses', () => {
  assert.doesNotThrow(() => new Script(adminClient));
});
