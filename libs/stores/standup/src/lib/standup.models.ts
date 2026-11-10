export type TeamView = {
  id: string;
  name: string;
  slug: string;
  role: 'ADMIN' | 'MEMBER';
};

export type ReplyNeeded = 'today' | 'week' | 'none';

export type StandupAnswerValue = {
  text?: string;
  optionId?: string;
  otherText?: string;
  helpFrom?: string;
  replyNeeded?: ReplyNeeded;
};

export type StandupQuestionOption = {
  id: string;
  label: string;
};

export type StandupQuestion = {
  id: string;
  type: 'text' | 'choice';
  prompt: string;
  enabled: boolean;
  required: boolean;
  builtin?: 'yesterday' | 'today' | 'blockers' | 'location' | 'hours';
  options?: StandupQuestionOption[];
  allowOther?: boolean;
};

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type DayHours = {
  enabled: boolean;
  start: string;
  end: string;
};

export type WeekSchedule = Record<Weekday, DayHours>;

export type StandupEntryView = {
  id: string;
  teamId: string;
  entryDate: string;
  status: 'DRAFT' | 'SUBMITTED';
  yesterday: string | null;
  today: string | null;
  blockers: string | null;
  answersJson: Record<string, StandupAnswerValue>;
};

export type StandupRosterStatus = 'posted' | 'open' | 'away';

export type StandupRosterMember = {
  userId: string;
  name: string;
  status: StandupRosterStatus;
  today: string | null;
};

export type StandupRecentDay = {
  entryDate: string;
  content: string | null;
};

export type StandupSummaryView = {
  id: string;
  teamId: string;
  entryDate: string;
  content: string;
};

export type StandupConfigView = {
  teamId: string;
  timezone: string;
  reminderHour: number;
  reminderMinute: number;
  scheduleKind: 'deadline' | 'window';
  windowStartHour: number;
  windowStartMinute: number;
  reveal: 'live' | 'together';
  questionsJson: StandupQuestion[];
};

export type StandupAnswersInput = {
  yesterday: string;
  today: string;
  blockers: string;
  answers: Record<string, StandupAnswerValue>;
};

export type StandupConfigInput = {
  timezone: string;
  reminderHour: number;
  reminderMinute: number;
  scheduleKind: 'deadline' | 'window';
  windowStartHour: number;
  windowStartMinute: number;
  reveal: 'live' | 'together';
  questionsJson: StandupQuestion[];
};

export type TeamMemberView = {
  id: string;
  userId: string;
  role: string;
  email?: string | null;
  displayName?: string | null;
  timezone: string;
  workHours: WeekSchedule;
};

export type TeamInviteView = {
  id: string;
  teamId: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  token: string;
  acceptPath: string;
  expiresAt: string;
  member?: TeamMemberView;
  /** True when Nest sent the invite via Resend for this create/resend call. */
  emailSent?: boolean;
  /** Resend error when a send was attempted but failed. */
  emailError?: string;
};

export type StandupState = {
  teams: TeamView[];
  selectedTeamId: string | null;
  entry: StandupEntryView | null;
  summary: StandupSummaryView | null;
  config: StandupConfigView | null;
  teamEntries: StandupEntryView[];
  loading: boolean;
  error: string | null;
};

export const STANDUP_INITIAL_STATE: StandupState = {
  teams: [],
  selectedTeamId: null,
  entry: null,
  summary: null,
  config: null,
  teamEntries: [],
  loading: false,
  error: null,
};
