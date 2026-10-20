export const widget = `(() => {
  const script = document.currentScript;
  const site = script.dataset.site;
  if (!site) return;
  const endpoint = new URL('/v1/count', script.src);
  endpoint.searchParams.set('site', site);
  const target = document.querySelector(script.dataset.target || '[data-visitor-counter]');
  let visitor;
  const key = 'visitor-counter:' + site;
  try {
    visitor = localStorage.getItem(key);
    if (!/^[a-f0-9-]{36}$/.test(visitor || '')) {
      visitor = crypto.randomUUID();
      localStorage.setItem(key, visitor);
    }
  } catch { visitor = crypto.randomUUID(); }
  fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor }), credentials: 'omit', keepalive: true
  }).then(response => {
    if (!response.ok) throw new Error('Counter unavailable');
    return response.json();
  }).then(data => {
    if (target) target.textContent = 'Today ' + data.todayVisitors.toLocaleString()
      + ' · Total ' + data.totalVisitorDays.toLocaleString();
    document.dispatchEvent(new CustomEvent('visitor-counter:loaded', { detail: data }));
  }).catch(() => {
    if (target) target.textContent = '—';
  });
})();`;
