import type { Weekday, WeekSchedule } from './standup.models';

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const WEEKDAY_FROM_SHORT: Record<string, Weekday> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

function day(enabled: boolean) {
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

export function weekFromUnknown(raw: unknown): WeekSchedule {
  const fallback = defaultWeek();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }
  const row = raw as Record<string, unknown>;
  const week = { ...fallback };
  for (const weekday of WEEKDAYS) {
    const value = row[weekday];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const hours = value as Record<string, unknown>;
    const start = typeof hours['start'] === 'string' ? hours['start'] : '09:00';
    const end = typeof hours['end'] === 'string' ? hours['end'] : '17:00';
    week[weekday] = {
      enabled: hours['enabled'] === true,
      start,
      end,
    };
  }
  return week;
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

export function localTimeLabel(timeZone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);
  } catch {
    return '';
  }
}

export function isWithinWorkHours(
  timeZone: string,
  week: WeekSchedule,
  now: Date,
): boolean {
  try {
    const short = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    }).format(now);
    const weekday: Weekday = WEEKDAY_FROM_SHORT[short] ?? 'mon';
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(
      parts.find((part) => part.type === 'hour')?.value ?? '0',
    );
    const minute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? '0',
    );
    const hours = week[weekday];
    if (!hours.enabled) {
      return false;
    }
    const nowMinutes = hour * 60 + minute;
    return (
      nowMinutes >= toMinutes(hours.start) && nowMinutes < toMinutes(hours.end)
    );
  } catch {
    return false;
  }
}
