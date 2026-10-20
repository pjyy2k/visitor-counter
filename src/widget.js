export const widget = `(() => {
  const script = document.currentScript;
  const site = script.dataset.site;
  if (!site) return;
  const endpoint = new URL('/v1/count', script.src);
  endpoint.searchParams.set('site', site);
  const target = document.querySelector(script.dataset.target || '[data-visitor-counter]');
  let visitor;
  function newId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16)
      + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }
  const key = 'visitor-counter:' + site;
  try {
    visitor = localStorage.getItem(key);
    if (!/^[a-f0-9-]{36}$/.test(visitor || '')) {
      visitor = newId();
      localStorage.setItem(key, visitor);
    }
  } catch { visitor = newId(); }
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
