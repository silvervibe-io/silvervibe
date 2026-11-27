export type FeedbackStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type FeedbackAnswerVisibility =
  | 'PRIVATE_TO_REQUESTER'
  | 'SHARED_WITH_INVITEES';
export type FeedbackClosePolicy =
  | 'CREATOR_OR_ADMIN'
  | 'CREATOR_ONLY'
  | 'ANY_INVITEE';

export type FeedbackSummaryView = {
  id: string;
  workspaceId: string;
  title: string;
  status: FeedbackStatus;
  answerVisibility: FeedbackAnswerVisibility;
  anonymous: boolean;
  closePolicy: FeedbackClosePolicy;
  endsAt: string | null;
  createdById: string;
  createdAt: string;
  inviteCount: number;
  promptCount: number;
  answerCount: number;
  hasContributed: boolean;
};

export type FeedbackInviteView = {
  userId: string;
  email: string | null;
  displayName: string | null;
};

export type FeedbackPromptView = {
  id: string;
  body: string;
  sortOrder: number;
};

export type FeedbackAnswerView = {
  id: string;
  promptId: string;
  body: string;
  authorId: string;
  authorDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  mine: boolean;
};

export type FeedbackDetailView = FeedbackSummaryView & {
  context: string | null;
  summary: string | null;
  prompts: FeedbackPromptView[];
  invites: FeedbackInviteView[];
  answers: FeedbackAnswerView[];
  canAnswer: boolean;
  canClose: boolean;
  canEditSettings: boolean;
};

export type CreateFeedbackInput = {
  title: string;
  context?: string | null;
  prompts: string[];
  answerVisibility: FeedbackAnswerVisibility;
  anonymous: boolean;
  closePolicy: FeedbackClosePolicy;
  endsAt?: string | null;
  inviteUserIds: string[];
};

export type UpsertAnswersInput = {
  answers: Array<{ promptId: string; body: string }>;
};

export type WorkspaceMemberView = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export type FeedbackState = {
  requests: FeedbackSummaryView[];
  selected: FeedbackDetailView | null;
  members: WorkspaceMemberView[];
  loading: boolean;
  error: string | null;
};

export const FEEDBACK_INITIAL_STATE: FeedbackState = {
  requests: [],
  selected: null,
  members: [],
  loading: false,
  error: null,
};
