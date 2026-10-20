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

/** Midnight UTC for a YYYY-MM-DD calendar day (matches Prisma Date @db.Date usage). */
export function parseCalendarDate(dateStr: string): Date {
  const iso = dateStr.trim().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}
