import { historyClient } from './history-client.js';

export const adminClient = String.raw`
const $ = (selector) => document.querySelector(selector);
function status(message, error = false) {
  $('#status').textContent = message;
  $('#status').className = error ? 'error' : 'success';
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) showWorkspace(false);
    throw new Error(data.error || '요청을 처리하지 못했습니다.');
  }
  return data;
}
function showWorkspace(value) {
  $('#workspace').hidden = !value;
  $('#logout').hidden = !value;
  $('#login-panel').hidden = value;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
async function pending(button, action) {
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = '처리 중…';
  try { await action(); }
  catch (error) { status(error.message, true); }
  finally { button.disabled = false; button.textContent = previous; }
}
function sitePanel(site) {
  const panel = element('article', undefined, 'panel');
  panel.append(element('h3', site.name));
  const link = element('a', site.url, 'site-url');
  link.href = site.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  panel.append(link);
  const lastSeen = site.last_seen_at ? new Date(site.last_seen_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '';
  panel.append(element('p', (site.active ? '수집 중' : '비활성화 · 수집 중지') + ' · '
    + (lastSeen ? '마지막 수집 ' + lastSeen + ' (한국시간)' : '수집 시각 미확인 · 설치 페이지에 접속한 뒤 새로고침하세요.'), 'hint'));
  const toggle = element('button', site.active ? '비활성화' : '다시 활성화', 'secondary');
  toggle.addEventListener('click', () => {
    if (!confirm(site.active ? '방문 수집을 중지할까요? 기존 통계와 삽입 코드는 보존됩니다.' : '방문 수집을 다시 시작할까요?')) return;
    pending(toggle, async () => {
      await api('/api/sites/' + site.id + '/active', { method: 'PUT', body: JSON.stringify({ active: !site.active }) });
      await loadSites(); status(site.active ? '수집을 중지했습니다. 기존 통계는 보존됩니다.' : '수집을 다시 시작했습니다.');
    });
  });
  panel.append(toggle);
  const metrics = element('div', undefined, 'metrics');
  for (const [label, value] of [['오늘 방문자', site.counts.todayVisitors], ['누적 방문', site.counts.totalVisitorDays], ['전체 조회수', site.counts.totalViews]]) {
    const metric = element('span', label);
    metric.append(element('b', Number(value).toLocaleString())); metrics.append(metric);
  }
  panel.append(metrics);
  const label = element('label', '이 사이트의 삽입 코드');
  const code = element('textarea'); code.readOnly = true; code.value = site.code;
  label.append(code); panel.append(label);
  const copy = element('button', '코드 복사', 'secondary');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(site.code); status(site.name + ' 코드가 복사되었습니다.'); }
    catch { code.focus(); code.select(); status('선택된 코드를 직접 복사해주세요.'); }
  });
  panel.append(copy);
  const details = element('details'); details.append(element('summary', '등록 정보 수정'));
  const form = element('form', undefined, 'stack');
  for (const [key, title] of [['name', '사이트 이름'], ['url', '사이트 주소']]) {
    const field = element('label', title); const input = element('input');
    input.name = key; input.value = site[key]; input.required = true;
    input.maxLength = key === 'name' ? 80 : 2048; field.append(input); form.append(field);
  }
  const save = element('button', '변경사항 저장'); form.append(save);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    pending(save, async () => {
      await api('/api/sites/' + site.id, { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      await loadSites(); status('사이트 정보를 수정했습니다. 기존 삽입 코드는 계속 사용할 수 있습니다.');
    });
  });
  details.append(form); panel.append(details, historyPanel(site)); return panel;
}
async function loadSites() {
  const { sites } = await api('/api/sites');
  $('#site-count').textContent = '(' + sites.length + ')';
  $('#sites').replaceChildren(...sites.map(sitePanel));
  if (!sites.length) $('#sites').append(element('p', '아직 등록된 사이트가 없습니다. 사이트를 등록하면 여기에 코드가 표시됩니다.', 'panel hint'));
}
$('#setup-form').addEventListener('submit', (event) => {
  event.preventDefault(); const form = event.currentTarget;
  pending(form.querySelector('button'), async () => {
    await api('/api/setup', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset(); $('#setup').hidden = true; $('#login-form').hidden = false;
    showWorkspace(true); await loadSites(); status('관리자 비밀번호를 설정했습니다. 사이트를 등록해주세요.');
  });
});
$('#login-form').addEventListener('submit', (event) => {
  event.preventDefault(); const form = event.currentTarget;
  pending(form.querySelector('button'), async () => {
    await api('/api/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset(); showWorkspace(true); await loadSites(); status('로그인했습니다.');
  });
});
$('#site-form').addEventListener('submit', (event) => {
  event.preventDefault(); const form = event.currentTarget;
  pending(form.querySelector('button'), async () => {
    await api('/api/sites', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset(); await loadSites(); status('등록했습니다. 생성된 코드를 복사해 해당 페이지에 삽입하세요.');
  });
});
$('#refresh').addEventListener('click', () => pending($('#refresh'), async () => { await loadSites(); status('집계를 새로 불러왔습니다.'); }));
$('#password-form').addEventListener('submit', (event) => {
  event.preventDefault(); const form = event.currentTarget;
  pending(form.querySelector('button'), async () => {
    await api('/api/password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset(); $('#sites').replaceChildren(); showWorkspace(false);
    status('비밀번호를 변경하고 모든 로그인을 종료했습니다. 새 비밀번호로 로그인해주세요.');
  });
});
$('#logout').addEventListener('click', () => pending($('#logout'), async () => {
  await api('/api/logout', { method: 'POST', body: '{}' });
  $('#sites').replaceChildren(); showWorkspace(false); status('로그아웃했습니다.');
}));
(async () => {
  try {
    const state = await api('/api/session'); showWorkspace(state.authenticated);
    $('#setup').hidden = state.configured;
    $('#login-form').hidden = !state.configured;
    if (state.authenticated) await loadSites();
  } catch (error) { status(error.message, true); }
})();
` + historyClient;
