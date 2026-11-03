import type { PreviewWorkspaceRole } from '@silvervibe/stores/preview';

export type WorkspaceToolView = {
  toolKey: string;
  enabled: boolean;
};

export type WorkspacePlanKey = 'free' | 'team';

export type WorkspaceMembershipView = {
  id: string;
  name: string;
  slug: string;
  planKey: WorkspacePlanKey;
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

export type SlackChannelOptionView = {
  id: string;
  label: string;
};

export type TeamSlackChannelView = {
  channelId: string | null;
  channelLabel: string | null;
  isOverride: boolean;
  workspaceChannelId: string | null;
  workspaceChannelLabel: string | null;
  slackConnected: boolean;
};

export type SetTeamSlackChannelInput = {
  channelId: string;
  channelLabel?: string;
};

export type TeamLinearProjectView = {
  projectId: string | null;
  projectName: string | null;
  isOverride: boolean;
  workspaceProjectId: string | null;
  workspaceProjectName: string | null;
  linearConnected: boolean;
};

export type SetTeamLinearProjectInput = {
  projectId: string;
};

export type TeamGithubTargetView = {
  owner: string | null;
  repo: string | null;
  issueNumber: number | null;
  issueTitle: string | null;
  isOverride: boolean;
  workspaceOwner: string | null;
  workspaceRepo: string | null;
  workspaceIssueNumber: number | null;
  workspaceIssueTitle: string | null;
  githubConnected: boolean;
};

export type SetTeamGithubTargetInput = {
  owner: string;
  repo: string;
  issueNumber: number;
};

export type TeamJiraTargetView = {
  cloudId: string | null;
  siteName: string | null;
  projectKey: string | null;
  issueKey: string | null;
  issueSummary: string | null;
  isOverride: boolean;
  workspaceCloudId: string | null;
  workspaceSiteName: string | null;
  workspaceProjectKey: string | null;
  workspaceIssueKey: string | null;
  workspaceIssueSummary: string | null;
  jiraConnected: boolean;
};

export type SetTeamJiraTargetInput = {
  cloudId: string;
  projectKey: string;
  issueKey: string;
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
