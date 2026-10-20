import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of ['0001_initial.sql', '0002_registry.sql', '0003_management.sql']) {
    sqlite.exec(readFileSync(new URL('../migrations/' + migration, import.meta.url), 'utf8'));
  }
  const prepare = (sql) => {
    let values = [];
    return {
      bind(...params) { values = params; return this; },
      async run() { return { meta: sqlite.prepare(sql).run(...values) }; },
      async first() { return sqlite.prepare(sql).get(...values); },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; }
    };
  };
  return { prepare, async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec('COMMIT'); return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
}
