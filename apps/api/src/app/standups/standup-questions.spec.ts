import {
  answersAreComplete,
  answersFromStorage,
  answerDisplay,
  blockerLine,
  defaultQuestions,
  questionsForSave,
  questionsFromStorage,
  StandupQuestionError,
} from './standup-questions';
import {
  isRevealed,
  scheduleFromConfig,
  submissionPhase,
} from './standup-schedule';

describe('standup questions', () => {
  it('turns the legacy prompt map into the builtin catalog', () => {
    const questions = questionsFromStorage({
      yesterday: 'Yesterday?',
      today: 'Today?',
      blockers: 'Blocked?',
    });
    expect(questions.find((q) => q.id === 'yesterday')?.prompt).toBe(
      'Yesterday?',
    );
    expect(questions.find((q) => q.id === 'location')?.enabled).toBe(false);
    expect(questions.find((q) => q.id === 'hours')?.enabled).toBe(false);
  });

  it('keeps builtins when a custom choice is added', () => {
    const questions = questionsForSave([
      ...defaultQuestions(),
      {
        id: 'mood',
        type: 'choice',
        prompt: 'How is the day?',
        enabled: true,
        required: false,
        allowOther: true,
        options: [{ id: 'good', label: 'Good' }],
      },
    ]);
    expect(questions.some((q) => q.id === 'mood')).toBe(true);
  });

  it('rejects a choice without enough options', () => {
    expect(() =>
      questionsForSave([
        ...defaultQuestions().filter((q) => q.id !== 'location'),
        {
          id: 'location',
          type: 'choice',
          prompt: 'Where?',
          enabled: true,
          required: false,
          builtin: 'location',
          options: [{ id: 'office', label: 'Office' }],
        },
      ]),
    ).toThrow(StandupQuestionError);
  });

  it('requires an explanation when Other is selected', () => {
    const location = defaultQuestions().find((q) => q.id === 'location');
    if (!location) {
      throw new Error('location question missing');
    }
    const enabled = { ...location, enabled: true, required: true };
    expect(
      answersAreComplete([enabled], {
        location: { optionId: 'other', otherText: 'Cafe' },
      }),
    ).toBe(true);
    expect(
      answerDisplay(enabled, { optionId: 'other', otherText: '' }),
    ).toBeNull();
  });
});

describe('blocker lines', () => {
  it('keeps a plain blocker when no help is requested', () => {
    expect(blockerLine({ text: 'Waiting on a key' })).toBe('Waiting on a key');
  });

  it('adds who can help and when a reply is needed', () => {
    expect(
      blockerLine({
        text: 'Waiting on a key',
        helpFrom: '@Ada',
        replyNeeded: 'today',
      }),
    ).toBe('Waiting on a key. Help from @Ada. Reply needed today.');
  });

  it('drops unknown reply values when reading stored answers', () => {
    expect(
      answersFromStorage({
        blockers: { text: 'Stuck', helpFrom: '@Ada', replyNeeded: 'tomorrow' },
      }).blockers,
    ).toEqual({ text: 'Stuck', helpFrom: '@Ada' });
  });
});

describe('standup schedule', () => {
  const deadline = scheduleFromConfig({
    timezone: 'UTC',
    scheduleKind: 'DEADLINE',
    reminderHour: 10,
    reminderMinute: 0,
    reveal: 'TOGETHER',
  });

  it('stays open before a deadline and closed at that minute', () => {
    expect(
      submissionPhase(deadline, new Date('2026-06-15T09:59:00.000Z')),
    ).toBe('open');
    expect(
      submissionPhase(deadline, new Date('2026-06-15T10:00:00.000Z')),
    ).toBe('after');
  });

  it('opens only inside a window', () => {
    const window = scheduleFromConfig({
      timezone: 'UTC',
      scheduleKind: 'WINDOW',
      windowStartHour: 8,
      windowStartMinute: 0,
      reminderHour: 10,
      reminderMinute: 0,
      reveal: 'LIVE',
    });
    expect(submissionPhase(window, new Date('2026-06-15T07:30:00.000Z'))).toBe(
      'before',
    );
    expect(submissionPhase(window, new Date('2026-06-15T08:00:00.000Z'))).toBe(
      'open',
    );
    expect(submissionPhase(window, new Date('2026-06-15T10:00:00.000Z'))).toBe(
      'after',
    );
  });

  it('hides a together summary until the standup time', () => {
    expect(isRevealed(deadline, new Date('2026-06-15T09:00:00.000Z'))).toBe(
      false,
    );
    expect(isRevealed(deadline, new Date('2026-06-15T10:00:00.000Z'))).toBe(
      true,
    );
  });
});
