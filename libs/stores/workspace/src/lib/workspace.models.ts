import type { PreviewWorkspaceRole } from '@silvervibe/stores/preview';

export type WorkspaceToolView = {
  toolKey: string;
  enabled: boolean;
};

export type WorkspaceMembershipView = {
  id: string;
  name: string;
  slug: string;
  role: PreviewWorkspaceRole;
  tools: WorkspaceToolView[];
};

export type CreateWorkspaceInput = {
  name: string;
  slug: string;
};

export type CreateTeamInput = {
  name: string;
  slug: string;
};

export type SlackConnectionView = {
  status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';
  configured: boolean;
  authMode: 'oauth' | 'webhook' | null;
  channelLabel: string | null;
  toolEnabled: boolean;
  oauthAvailable: boolean;
};

export type SlackOAuthStartView = {
  authorizeUrl: string;
};

export type TeamsConnectionView = {
  status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';
  configured: boolean;
  channelLabel: string | null;
  toolEnabled: boolean;
};

export type ConnectTeamsInput = {
  incomingWebhookUrl: string;
  channelLabel?: string;
};

export type LinearConnectionView = {
  status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';
  configured: boolean;
  projectId: string | null;
  projectName: string | null;
  organizationName: string | null;
  toolEnabled: boolean;
  oauthAvailable: boolean;
};

export type LinearOAuthStartView = {
  authorizeUrl: string;
};

export type LinearProjectView = {
  id: string;
  name: string;
};

export type SelectLinearProjectInput = {
  projectId: string;
};

export type GithubConnectionView = {
  status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';
  configured: boolean;
  repoFullName: string | null;
  issueNumber: number | null;
  issueTitle: string | null;
  accountLogin: string | null;
  toolEnabled: boolean;
  oauthAvailable: boolean;
};

export type GithubOAuthStartView = {
  authorizeUrl: string;
};

export type GithubRepoView = {
  fullName: string;
  owner: string;
  name: string;
};

export type GithubIssueView = {
  number: number;
  title: string;
};

export type SelectGithubTargetInput = {
  owner: string;
  repo: string;
  issueNumber: number;
};

export type JiraConnectionView = {
  status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';
  configured: boolean;
  cloudId: string | null;
  siteName: string | null;
  projectKey: string | null;
  issueKey: string | null;
  issueSummary: string | null;
  toolEnabled: boolean;
  oauthAvailable: boolean;
};

export type JiraOAuthStartView = {
  authorizeUrl: string;
};

export type JiraSiteView = {
  cloudId: string;
  name: string;
  url: string;
};

export type JiraProjectView = {
  id: string;
  key: string;
  name: string;
};

export type JiraIssueView = {
  key: string;
  summary: string;
};

export type SelectJiraSiteInput = {
  cloudId: string;
};

export type SelectJiraTargetInput = {
  cloudId: string;
  projectKey: string;
  issueKey: string;
};

export type WorkspaceState = {
  memberships: WorkspaceMembershipView[];
  selectedWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
};

export const WORKSPACE_INITIAL_STATE: WorkspaceState = {
  memberships: [],
  selectedWorkspaceId: null,
  loading: false,
  error: null,
};
