export const QUESTION_BUILTINS = [
  'yesterday',
  'today',
  'blockers',
  'location',
  'hours',
] as const;

export type QuestionBuiltin = (typeof QUESTION_BUILTINS)[number];
export type QuestionType = 'text' | 'choice';

export type StandupQuestionOption = {
  id: string;
  label: string;
};

export type StandupQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  enabled: boolean;
  required: boolean;
  builtin?: QuestionBuiltin;
  options?: StandupQuestionOption[];
  allowOther?: boolean;
};

export type StandupAnswer = {
  text?: string;
  optionId?: string;
  otherText?: string;
};

const MAX_QUESTIONS = 12;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/;

export class StandupQuestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StandupQuestionError';
  }
}

export function defaultQuestions(): StandupQuestion[] {
  return [
    {
      id: 'yesterday',
      type: 'text',
      prompt: 'What did you do yesterday?',
      enabled: true,
      required: true,
      builtin: 'yesterday',
    },
    {
      id: 'today',
      type: 'text',
      prompt: 'What will you do today?',
      enabled: true,
      required: true,
      builtin: 'today',
    },
    {
      id: 'blockers',
      type: 'text',
      prompt: 'Any blockers?',
      enabled: true,
      required: false,
      builtin: 'blockers',
    },
    {
      id: 'location',
      type: 'choice',
      prompt: 'Where are you working today?',
      enabled: false,
      required: false,
      builtin: 'location',
      allowOther: true,
      options: [
        { id: 'office', label: 'Office' },
        { id: 'remote', label: 'Remote' },
      ],
    },
    {
      id: 'hours',
      type: 'text',
      prompt: 'Hours available today',
      enabled: false,
      required: false,
      builtin: 'hours',
    },
  ];
}

function isBuiltin(value: string): value is QuestionBuiltin {
  return (QUESTION_BUILTINS as readonly string[]).includes(value);
}

function cleanPrompt(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}

function fromLegacyMap(raw: Record<string, unknown>): StandupQuestion[] {
  const questions = defaultQuestions();
  for (const question of questions) {
    if (!question.builtin) {
      continue;
    }
    const prompt = cleanPrompt(raw[question.builtin]);
    if (prompt) {
      question.prompt = prompt;
    }
  }
  return questions;
}

function readOption(raw: unknown): StandupQuestionOption | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = typeof row['id'] === 'string' ? row['id'].trim() : '';
  const label = cleanPrompt(row['label']).slice(0, 80);
  if (!ID_PATTERN.test(id) || !label || id === 'other') {
    return null;
  }
  return { id, label };
}

function readQuestion(raw: unknown): StandupQuestion | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = typeof row['id'] === 'string' ? row['id'].trim() : '';
  const type =
    row['type'] === 'choice'
      ? 'choice'
      : row['type'] === 'text'
        ? 'text'
        : null;
  const prompt = cleanPrompt(row['prompt']);
  if (!ID_PATTERN.test(id) || !type || !prompt) {
    return null;
  }
  const builtin =
    typeof row['builtin'] === 'string' && isBuiltin(row['builtin'])
      ? row['builtin']
      : undefined;
  if (builtin && builtin !== id) {
    return null;
  }
  const question: StandupQuestion = {
    id,
    type: builtin === 'location' ? 'choice' : builtin ? 'text' : type,
    prompt,
    enabled: row['enabled'] === true,
    required: row['required'] === true,
    ...(builtin ? { builtin } : {}),
  };
  if (question.type === 'choice') {
    const options = Array.isArray(row['options'])
      ? row['options']
          .map(readOption)
          .filter((option): option is StandupQuestionOption => option !== null)
          .slice(0, 8)
      : [];
    const seen = new Set<string>();
    question.options = options.filter((option) => {
      if (seen.has(option.id)) {
        return false;
      }
      seen.add(option.id);
      return true;
    });
    question.allowOther = row['allowOther'] === true;
  }
  return question;
}

function assertChoice(question: StandupQuestion): void {
  if (question.type !== 'choice') {
    return;
  }
  const count = question.options?.length ?? 0;
  const enough = count >= 2 || (count >= 1 && question.allowOther === true);
  if (!enough) {
    throw new StandupQuestionError('standup.questions');
  }
}

/** Accept the stored map or list and always return the full builtin catalog. */
export function questionsFromStorage(raw: unknown): StandupQuestion[] {
  if (Array.isArray(raw)) {
    const parsed = raw
      .map(readQuestion)
      .filter((question): question is StandupQuestion => question !== null);
    if (parsed.length === 0) {
      return defaultQuestions();
    }
    return ensureBuiltins(parsed);
  }
  if (raw && typeof raw === 'object') {
    return fromLegacyMap(raw as Record<string, unknown>);
  }
  return defaultQuestions();
}

function ensureBuiltins(questions: StandupQuestion[]): StandupQuestion[] {
  const seen = new Set<string>();
  const unique: StandupQuestion[] = [];
  for (const question of questions) {
    if (seen.has(question.id)) {
      continue;
    }
    seen.add(question.id);
    unique.push(question);
  }
  for (const builtin of defaultQuestions()) {
    if (!seen.has(builtin.id)) {
      unique.push({ ...builtin, enabled: false });
    }
  }
  return unique.slice(0, MAX_QUESTIONS);
}

/** Reject a team-admin save that drops builtins or has an invalid choice. */
export function questionsForSave(raw: unknown): StandupQuestion[] {
  if (!Array.isArray(raw)) {
    throw new StandupQuestionError('standup.questions');
  }
  const parsed = raw.map((item) => {
    const question = readQuestion(item);
    if (!question) {
      throw new StandupQuestionError('standup.questions');
    }
    assertChoice(question);
    return question;
  });
  const ids = new Set(parsed.map((question) => question.id));
  if (ids.size !== parsed.length) {
    throw new StandupQuestionError('standup.questions');
  }
  for (const builtin of QUESTION_BUILTINS) {
    if (!ids.has(builtin)) {
      throw new StandupQuestionError('standup.questions');
    }
  }
  if (parsed.length > MAX_QUESTIONS) {
    throw new StandupQuestionError('standup.questions');
  }
  return parsed;
}

export function answersFromStorage(
  raw: unknown,
): Record<string, StandupAnswer> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const answers: Record<string, StandupAnswer> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (
      !ID_PATTERN.test(key) ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      continue;
    }
    const row = value as Record<string, unknown>;
    const answer: StandupAnswer = {};
    if (typeof row['text'] === 'string') {
      answer.text = row['text'].slice(0, 4000);
    }
    if (
      typeof row['optionId'] === 'string' &&
      ID_PATTERN.test(row['optionId'])
    ) {
      answer.optionId = row['optionId'];
    }
    if (row['optionId'] === 'other') {
      answer.optionId = 'other';
    }
    if (typeof row['otherText'] === 'string') {
      answer.otherText = row['otherText'].slice(0, 500);
    }
    answers[key] = answer;
  }
  return answers;
}

export function mirrorBuiltinColumns(
  questions: StandupQuestion[],
  answers: Record<string, StandupAnswer>,
): { yesterday: string | null; today: string | null; blockers: string | null } {
  const textOf = (builtin: QuestionBuiltin): string | null => {
    const question = questions.find(
      (item) => item.builtin === builtin && item.type === 'text',
    );
    const text = question ? (answers[question.id]?.text?.trim() ?? '') : '';
    return text || null;
  };
  return {
    yesterday: textOf('yesterday'),
    today: textOf('today'),
    blockers: textOf('blockers'),
  };
}

export function answerDisplay(
  question: StandupQuestion,
  answer: StandupAnswer | undefined,
): string | null {
  if (!answer) {
    return null;
  }
  if (question.type === 'text') {
    const text = answer.text?.trim() ?? '';
    return text || null;
  }
  if (answer.optionId === 'other') {
    const other = answer.otherText?.trim() ?? '';
    return other ? `Other: ${other}` : null;
  }
  const label = question.options?.find(
    (option) => option.id === answer.optionId,
  )?.label;
  return label ?? null;
}

export function answersAreComplete(
  questions: StandupQuestion[],
  answers: Record<string, StandupAnswer>,
): boolean {
  return questions.every((question) => {
    if (!question.enabled || !question.required) {
      return true;
    }
    return answerDisplay(question, answers[question.id]) !== null;
  });
}
