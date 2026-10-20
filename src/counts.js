export function calendarDay(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function countVisit(db, visit) {
  const { site, day, visitor } = visit;
  // D1 batch is atomic; the insert trigger increments visitors only for a new ID.
  await db.batch([
    db.prepare(`INSERT INTO daily_counts(site,day,views) VALUES(?,?,1)
      ON CONFLICT(site,day) DO UPDATE SET views=views+1`).bind(site, day),
    db.prepare(`INSERT INTO site_counts(site,views) VALUES(?,1)
      ON CONFLICT(site) DO UPDATE SET views=views+1`).bind(site),
    db.prepare('INSERT OR IGNORE INTO daily_visitors VALUES(?,?,?)').bind(site, day, visitor)
  ]);
}

export async function readCounts(db, visit) {
  const row = await db.prepare(`SELECT
    COALESCE((SELECT views FROM daily_counts WHERE site=?1 AND day=?2),0) AS todayViews,
    COALESCE((SELECT visitors FROM daily_counts WHERE site=?1 AND day=?2),0) AS todayVisitors,
    COALESCE((SELECT views FROM site_counts WHERE site=?1),0) AS totalViews,
    COALESCE((SELECT visitor_days FROM site_counts WHERE site=?1),0) AS totalVisitorDays`
  ).bind(visit.site, visit.day).first();
  return { site: visit.site, day: visit.day, ...row };
}
