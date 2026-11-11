export type MentionIssue = {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'trello' | 'jira' | 'linear';
  key: string;
  title: string;
  url: string;
};
