/**
 * Calendar date (YYYY-MM-DD) for `timeZone` at `now`.
 * Uses `en-CA` so the formatter emits ISO-like dates.
 */
export function calendarDateInTimezone(
  timeZone: string,
  now: Date = new Date(),
): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Local hour (0–23) and minute (0–59) for `timeZone` at `now`. */
export function clockInTimezone(
  timeZone: string,
  now: Date = new Date(),
): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return { hour, minute };
  } catch {
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}

/**
 * True when `now` falls in the same 15-minute bucket as the configured
 * reminder time in `timeZone` (aligned with a every-15-minutes cron).
 */
export function isInReminderWindow(
  timeZone: string,
  reminderHour: number,
  reminderMinute: number,
  now: Date = new Date(),
): boolean {
  const local = clockInTimezone(timeZone, now);
  const localSlot = Math.floor((local.hour * 60 + local.minute) / 15);
  const targetSlot = Math.floor((reminderHour * 60 + reminderMinute) / 15);
  return localSlot === targetSlot;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** UTC instant when `timeZone` shows `date` at `hour`:`minute`. */
export function instantAtLocalTime(
  date: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const desired = Date.parse(`${date}T${pad2(hour)}:${pad2(minute)}:00.000Z`);
  let guess = desired;
  for (let step = 0; step < 3; step += 1) {
    const seenDate = calendarDateInTimezone(timeZone, new Date(guess));
    const seen = clockInTimezone(timeZone, new Date(guess));
    const seenStamp = Date.parse(
      `${seenDate}T${pad2(seen.hour)}:${pad2(seen.minute)}:00.000Z`,
    );
    const delta = desired - seenStamp;
    if (delta === 0) {
      break;
    }
    guess += delta;
  }
  return new Date(guess);
}

export function clockLabel(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function shiftCalendarDate(date: string, days: number): string {
  const next = parseCalendarDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Newest first, including `today`. */
export function recentCalendarDates(today: string, count = 14): string[] {
  return Array.from({ length: count }, (_, index) =>
    shiftCalendarDate(today, -index),
  );
}

/** Midnight UTC for a YYYY-MM-DD calendar day (matches Prisma Date @db.Date usage). */
export function parseCalendarDate(dateStr: string): Date {
  const iso = dateStr.trim().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}
