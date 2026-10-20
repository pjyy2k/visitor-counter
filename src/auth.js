import { adminJson, HttpError, readJson } from './http.js';

export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt),
    iterations: 100000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function credentials(db) {
  return db.prepare('SELECT salt,password_hash FROM admin_credentials WHERE id=1').first();
}

function sessionToken(request) {
  return request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-vc_session=([a-f0-9]{64})(?:;|$)/)?.[1] || '';
}

export async function authenticated(request, env) {
  const token = sessionToken(request);
  if (!token) return false;
  const row = await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash=?')
    .bind(await digest(token)).first();
  return Boolean(row && row.expires_at > Date.now());
}

async function createSession(db) {
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  await db.prepare('INSERT INTO admin_sessions VALUES(?,?)')
    .bind(await digest(token), Date.now() + 43200000).run();
  return adminJson({ ok: true }, 200, {
    'Set-Cookie': `__Host-vc_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
  });
}

export async function setup(request, env) {
  if (await credentials(env.DB)) throw new HttpError(409, '관리자 비밀번호가 이미 설정되어 있습니다. 로그인해주세요.');
  const data = await readJson(request);
  if (!data || typeof data.password !== 'string' || data.password.length < 10 || data.password.length > 256
      || data.password !== data.confirmPassword) {
    throw new HttpError(400, '비밀번호를 10~256자로 입력하고 동일하게 확인해주세요.');
  }
  const salt = crypto.randomUUID();
  const hash = await passwordHash(data.password, salt);
  // The singleton primary key prevents two simultaneous first-time setups.
  const result = await env.DB.prepare('INSERT OR IGNORE INTO admin_credentials VALUES(1,?,?)').bind(salt, hash).run();
  if (result.meta.changes !== 1) throw new HttpError(409, '관리자 비밀번호가 이미 설정되어 있습니다.');
  return createSession(env.DB);
}

export async function login(request, env) {
  const saved = await credentials(env.DB);
  if (!saved) throw new HttpError(409, '최초 관리자 비밀번호를 먼저 설정해주세요.');
  const data = await readJson(request);
  if (!data || typeof data.password !== 'string' || data.password.length > 256) {
    throw new HttpError(400, '비밀번호를 입력해주세요.');
  }
  const hour = Math.floor(Date.now() / 3600000);
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = await digest(saved.salt + ':' + ip + ':' + hour);
  const row = await env.DB.prepare(`INSERT INTO login_attempts(key,attempts,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts`)
    .bind(key, (hour + 1) * 3600000).first();
  if (row.attempts > 20) throw new HttpError(429, '로그인 시도가 너무 많습니다. 다음 시간대에 다시 시도해주세요.');
  const supplied = await passwordHash(data.password, saved.salt);
  let difference = 0;
  for (let i = 0; i < saved.password_hash.length; i++) difference |= supplied.charCodeAt(i) ^ saved.password_hash.charCodeAt(i);
  if (difference) throw new HttpError(401, '비밀번호가 올바르지 않습니다.');
  return createSession(env.DB);
}

export async function logout(request, env) {
  await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?')
    .bind(await digest(sessionToken(request))).run();
  return adminJson({ ok: true }, 200, {
    'Set-Cookie': '__Host-vc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  });
}
