import { isWithinWorkHours, parseWeek, weekFromStorage } from './work-hours';

describe('work hours', () => {
  it('rejects a day that ends before it starts', () => {
    const week = weekFromStorage(undefined);
    week.mon = { enabled: true, start: '17:00', end: '09:00' };
    expect(parseWeek(week)).toBeNull();
  });

  it('treats the person as in hours only inside an enabled day', () => {
    const week = weekFromStorage(undefined);
    const monday = new Date('2026-06-15T10:00:00.000Z');
    expect(isWithinWorkHours('UTC', week, monday, 10, 0)).toBe(true);
    expect(isWithinWorkHours('UTC', week, monday, 17, 0)).toBe(false);
    const saturday = new Date('2026-06-13T10:00:00.000Z');
    expect(isWithinWorkHours('UTC', week, saturday, 10, 0)).toBe(false);
  });
});
