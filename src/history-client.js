export const historyClient = String.raw`
function historyPanel(site) {
  const details = element('details'); details.append(element('summary', '최근 방문 추이'));
  const controls = element('div', undefined, 'cluster');
  const output = element('div'); output.setAttribute('aria-live', 'polite');
  let loaded = false;
  const buttons = [7, 30].map(days => {
    const button = element('button', '최근 ' + days + '일', 'secondary');
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => load(days)); controls.append(button); return button;
  });
  async function load(days) {
    for (const button of buttons) button.disabled = true;
    output.textContent = '방문 기록을 불러오는 중…';
    try {
      const { history } = await api('/api/sites/' + site.id + '/history?days=' + days);
      loaded = true;
      buttons.forEach((button, index) => button.setAttribute('aria-pressed', String([7, 30][index] === days)));
      const table = element('table', undefined, 'history-table');
      table.append(element('caption', site.name + ' · 최근 ' + days + '일 (한국시간)'));
      const head = element('thead'); const header = element('tr');
      for (const text of ['날짜', '방문자', '조회수']) {
        const th = element('th', text); th.scope = 'col'; header.append(th);
      }
      head.append(header); table.append(head); const body = element('tbody');
      const maximum = Math.max(1, ...history.map(day => day.visitors));
      for (const day of history) {
        const row = element('tr'); const date = element('th', day.day); date.scope = 'row'; row.append(date);
        const visitors = element('td'); visitors.append(element('span', String(day.visitors)));
        const bar = element('meter'); bar.min = 0; bar.max = maximum; bar.value = day.visitors;
        bar.setAttribute('aria-label', day.day + ' 방문자 ' + day.visitors + '명'); visitors.append(bar);
        row.append(visitors, element('td', String(day.views))); body.append(row);
      }
      table.append(body); output.replaceChildren(table);
    } catch (error) { output.textContent = error.message; }
    finally { for (const button of buttons) button.disabled = false; }
  }
  details.addEventListener('toggle', () => { if (details.open && !loaded) load(7); });
  details.append(controls, output); return details;
}
`;
