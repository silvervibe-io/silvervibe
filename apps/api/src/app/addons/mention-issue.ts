export type MentionIssue = {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'jira' | 'linear';
  key: string;
  title: string;
  url: string;
};
