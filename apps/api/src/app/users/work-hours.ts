export const WEEKDAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type DayHours = {
  enabled: boolean;
  start: string;
  end: string;
};

export type WeekSchedule = Record<Weekday, DayHours>;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAY_FROM_SHORT: Record<string, Weekday> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

function day(enabled: boolean): DayHours {
  return { enabled, start: '09:00', end: '17:00' };
}

export function defaultWeek(): WeekSchedule {
  return {
    mon: day(true),
    tue: day(true),
    wed: day(true),
    thu: day(true),
    fri: day(true),
    sat: day(false),
    sun: day(false),
  };
}

function readDay(raw: unknown, fallback: DayHours): DayHours {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }
  const row = raw as Record<string, unknown>;
  const start =
    typeof row['start'] === 'string' ? row['start'] : fallback.start;
  const end = typeof row['end'] === 'string' ? row['end'] : fallback.end;
  return {
    enabled: row['enabled'] === true,
    start: TIME_PATTERN.test(start) ? start : fallback.start,
    end: TIME_PATTERN.test(end) ? end : fallback.end,
  };
}

export function weekFromStorage(raw: unknown): WeekSchedule {
  const fallback = defaultWeek();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }
  const row = raw as Record<string, unknown>;
  return {
    mon: readDay(row['mon'], fallback.mon),
    tue: readDay(row['tue'], fallback.tue),
    wed: readDay(row['wed'], fallback.wed),
    thu: readDay(row['thu'], fallback.thu),
    fri: readDay(row['fri'], fallback.fri),
    sat: readDay(row['sat'], fallback.sat),
    sun: readDay(row['sun'], fallback.sun),
  };
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map((part) => Number(part));
  return hour * 60 + minute;
}

/** Strict parse for a member save. Returns null when a day or time is missing. */
export function parseWeek(raw: unknown): WeekSchedule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const week = {} as WeekSchedule;
  for (const weekday of WEEKDAYS) {
    const value = row[weekday];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const dayRow = value as Record<string, unknown>;
    if (typeof dayRow['enabled'] !== 'boolean') {
      return null;
    }
    if (
      typeof dayRow['start'] !== 'string' ||
      !TIME_PATTERN.test(dayRow['start'])
    ) {
      return null;
    }
    if (
      typeof dayRow['end'] !== 'string' ||
      !TIME_PATTERN.test(dayRow['end'])
    ) {
      return null;
    }
    week[weekday] = {
      enabled: dayRow['enabled'],
      start: dayRow['start'],
      end: dayRow['end'],
    };
  }
  return weekProblems(week) ? null : week;
}

export function weekProblems(week: WeekSchedule): string | null {
  for (const weekday of WEEKDAYS) {
    const hours = week[weekday];
    if (!TIME_PATTERN.test(hours.start) || !TIME_PATTERN.test(hours.end)) {
      return 'schedule.invalid';
    }
    if (hours.enabled && toMinutes(hours.end) <= toMinutes(hours.start)) {
      return 'schedule.invalid';
    }
  }
  return null;
}

export function weekdayInTimezone(timeZone: string, now: Date): Weekday {
  try {
    const short = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    }).format(now);
    return WEEKDAY_FROM_SHORT[short] ?? 'mon';
  } catch {
    return 'mon';
  }
}

export function isWithinWorkHours(
  timeZone: string,
  week: WeekSchedule,
  now: Date,
  hour: number,
  minute: number,
): boolean {
  const hours = week[weekdayInTimezone(timeZone, now)];
  if (!hours.enabled) {
    return false;
  }
  const nowMinutes = hour * 60 + minute;
  return (
    nowMinutes >= toMinutes(hours.start) && nowMinutes < toMinutes(hours.end)
  );
}
