import { calendarDay } from './counts.js';

export async function readHistory(db, options) {
  const today = calendarDay(options.timeZone || 'Asia/Seoul', options.now || new Date());
  const end = new Date(today + 'T00:00:00Z');
  const days = Array.from({ length: options.days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - options.days + 1 + index);
    return date.toISOString().slice(0, 10);
  });
  const { results } = await db.prepare(`SELECT day,views,visitors FROM daily_counts
    WHERE site=? AND day>=? AND day<=? ORDER BY day`).bind(options.site, days[0], today).all();
  const byDay = new Map(results.map((row) => [row.day, row]));
  return days.map((day) => byDay.get(day) || { day, views: 0, visitors: 0 });
}
