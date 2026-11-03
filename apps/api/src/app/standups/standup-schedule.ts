import { clockInTimezone, isInReminderWindow } from './standup-date.util';

export type ScheduleKind = 'deadline' | 'window';
export type RevealMode = 'live' | 'together';

export type StandupSchedule = {
  timezone: string;
  scheduleKind: ScheduleKind;
  windowStartHour: number;
  windowStartMinute: number;
  endHour: number;
  endMinute: number;
  reveal: RevealMode;
};

export type SubmissionPhase = 'open' | 'before' | 'after';

function clampHour(value: unknown, fallback: number): number {
  const hour = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(hour)) {
    return fallback;
  }
  return Math.min(23, Math.max(0, Math.trunc(hour)));
}

function clampMinute(value: unknown, fallback: number): number {
  const minute = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(minute)) {
    return fallback;
  }
  return Math.min(59, Math.max(0, Math.trunc(minute)));
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function scheduleFromConfig(
  config: {
    timezone?: string | null;
    scheduleKind?: string | null;
    windowStartHour?: number | null;
    windowStartMinute?: number | null;
    reminderHour?: number | null;
    reminderMinute?: number | null;
    reveal?: string | null;
  } | null,
): StandupSchedule {
  return {
    timezone: config?.timezone?.trim() || 'UTC',
    scheduleKind: config?.scheduleKind === 'WINDOW' ? 'window' : 'deadline',
    windowStartHour: clampHour(config?.windowStartHour, 8),
    windowStartMinute: clampMinute(config?.windowStartMinute, 0),
    endHour: clampHour(config?.reminderHour, 9),
    endMinute: clampMinute(config?.reminderMinute, 0),
    reveal: config?.reveal === 'TOGETHER' ? 'together' : 'live',
  };
}

export function minutesOf(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function submissionPhase(
  schedule: StandupSchedule,
  now: Date = new Date(),
): SubmissionPhase {
  const local = clockInTimezone(schedule.timezone, now);
  const nowMinutes = minutesOf(local.hour, local.minute);
  const end = minutesOf(schedule.endHour, schedule.endMinute);
  if (schedule.scheduleKind === 'deadline') {
    return nowMinutes < end ? 'open' : 'after';
  }
  const start = minutesOf(schedule.windowStartHour, schedule.windowStartMinute);
  if (nowMinutes < start) {
    return 'before';
  }
  if (nowMinutes < end) {
    return 'open';
  }
  return 'after';
}

export function isRevealed(
  schedule: StandupSchedule,
  now: Date = new Date(),
): boolean {
  if (schedule.reveal === 'live') {
    return true;
  }
  const local = clockInTimezone(schedule.timezone, now);
  return (
    minutesOf(local.hour, local.minute) >=
    minutesOf(schedule.endHour, schedule.endMinute)
  );
}

export function isReminderSlot(schedule: StandupSchedule, now: Date): boolean {
  if (schedule.scheduleKind === 'window') {
    return isInReminderWindow(
      schedule.timezone,
      schedule.windowStartHour,
      schedule.windowStartMinute,
      now,
    );
  }
  return isInReminderWindow(
    schedule.timezone,
    schedule.endHour,
    schedule.endMinute,
    now,
  );
}

export function isCollectionSlot(
  schedule: StandupSchedule,
  now: Date,
): boolean {
  return isInReminderWindow(
    schedule.timezone,
    schedule.endHour,
    schedule.endMinute,
    now,
  );
}

export function assertSchedule(input: {
  timezone: string;
  scheduleKind: ScheduleKind;
  windowStartHour: number;
  windowStartMinute: number;
  endHour: number;
  endMinute: number;
}): void {
  if (!isValidTimezone(input.timezone.trim())) {
    throw new Error('standup.timezone');
  }
  if (
    input.scheduleKind === 'window' &&
    minutesOf(input.windowStartHour, input.windowStartMinute) >=
      minutesOf(input.endHour, input.endMinute)
  ) {
    throw new Error('standup.window');
  }
}
