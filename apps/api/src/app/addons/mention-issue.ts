export type MentionIssue = {
  provider: 'github' | 'gitlab' | 'jira' | 'linear';
  key: string;
  title: string;
  url: string;
};
