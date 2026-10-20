import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';
import { calendarDay, countVisit, readCounts } from '../src/counts.js';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
  const prepare = (sql) => {
    let values = [];
    return {
      bind(...params) { values = params; return this; },
      async run() { return sqlite.prepare(sql).run(...values); },
      async first() { return sqlite.prepare(sql).get(...values); }
    };
  };
  return { prepare, async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      for (const statement of statements) await statement.run();
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
}

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
