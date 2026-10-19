export type TeamView = {
  id: string;
  name: string;
  slug: string;
  role: 'ADMIN' | 'MEMBER';
};

export type StandupEntryView = {
  id: string;
  teamId: string;
  entryDate: string;
  status: 'DRAFT' | 'SUBMITTED';
  yesterday: string | null;
  today: string | null;
  blockers: string | null;
};

export type StandupSummaryView = {
  id: string;
  teamId: string;
  entryDate: string;
  content: string;
};

export type StandupQuestions = {
  yesterday?: string;
  today?: string;
  blockers?: string;
};

export type StandupConfigView = {
  teamId: string;
  timezone: string;
  questionsJson: StandupQuestions;
};

export type StandupAnswersInput = {
  yesterday: string;
  today: string;
  blockers: string;
};

export type StandupConfigInput = {
  timezone: string;
  questionsJson: StandupQuestions;
};

export type TeamMemberView = {
  id: string;
  userId: string;
  role: string;
  email?: string | null;
  displayName?: string | null;
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
