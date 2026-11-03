import type { StandupConfigView } from './standup.models';

export type SubmissionPhase = 'open' | 'before' | 'after';

function minutesInTimezone(timeZone: string, now: Date): number {
  try {
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
    return hour * 60 + minute;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

export function submissionPhase(
  config: Pick<
    StandupConfigView,
    | 'timezone'
    | 'scheduleKind'
    | 'windowStartHour'
    | 'windowStartMinute'
    | 'reminderHour'
    | 'reminderMinute'
  >,
  now: Date,
): SubmissionPhase {
  const nowMinutes = minutesInTimezone(config.timezone, now);
  const end = config.reminderHour * 60 + config.reminderMinute;
  if (config.scheduleKind === 'deadline') {
    return nowMinutes < end ? 'open' : 'after';
  }
  const start = config.windowStartHour * 60 + config.windowStartMinute;
  if (nowMinutes < start) {
    return 'before';
  }
  return nowMinutes < end ? 'open' : 'after';
}

export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
