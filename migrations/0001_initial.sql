CREATE TABLE daily_counts (
  site TEXT NOT NULL,
  day TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site, day)
) WITHOUT ROWID;

CREATE TABLE site_counts (
  site TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  visitor_days INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

CREATE TABLE daily_visitors (
  site TEXT NOT NULL,
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  PRIMARY KEY (site, day, visitor)
) WITHOUT ROWID;
CREATE INDEX daily_visitors_day ON daily_visitors(day);

CREATE TRIGGER record_view AFTER INSERT ON daily_visitors
BEGIN
  UPDATE daily_counts SET visitors = visitors + 1
    WHERE site = NEW.site AND day = NEW.day;
  UPDATE site_counts SET visitor_days = visitor_days + 1 WHERE site = NEW.site;
END;
