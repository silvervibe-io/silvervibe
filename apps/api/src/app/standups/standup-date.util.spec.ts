import {
  calendarDateInTimezone,
  clockInTimezone,
  isInReminderWindow,
  parseCalendarDate,
} from './standup-date.util';

describe('standup-date.util', () => {
  it('formats a fixed instant in America/New_York', () => {
    // 2026-06-15 03:30 UTC → 2026-06-14 23:30 in New York (EDT, UTC-4)
    const now = new Date('2026-06-15T03:30:00.000Z');
    expect(calendarDateInTimezone('America/New_York', now)).toBe('2026-06-14');
    expect(calendarDateInTimezone('UTC', now)).toBe('2026-06-15');
  });

  it('falls back to UTC date for invalid timezones', () => {
    const now = new Date('2026-01-02T12:00:00.000Z');
    expect(calendarDateInTimezone('Not/A_Zone', now)).toBe('2026-01-02');
  });

  it('parses calendar dates as UTC midnight', () => {
    const d = parseCalendarDate('2026-10-20');
    expect(d.toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it('reads local clock parts in a timezone', () => {
    const now = new Date('2026-06-15T13:07:00.000Z');
    expect(clockInTimezone('UTC', now)).toEqual({ hour: 13, minute: 7 });
    // EDT = UTC-4 → 09:07
    expect(clockInTimezone('America/New_York', now)).toEqual({
      hour: 9,
      minute: 7,
    });
  });

  it('matches the 15-minute reminder bucket', () => {
    const now = new Date('2026-06-15T13:07:00.000Z'); // 09:07 America/New_York
    expect(isInReminderWindow('America/New_York', 9, 0, now)).toBe(true);
    expect(isInReminderWindow('America/New_York', 9, 14, now)).toBe(true);
    expect(isInReminderWindow('America/New_York', 9, 15, now)).toBe(false);
    expect(isInReminderWindow('UTC', 13, 0, now)).toBe(true);
    expect(isInReminderWindow('UTC', 12, 0, now)).toBe(false);
  });
});
