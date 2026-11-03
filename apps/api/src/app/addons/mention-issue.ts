export type MentionIssue = {
  provider: 'github' | 'jira' | 'linear';
  key: string;
  title: string;
  url: string;
};
