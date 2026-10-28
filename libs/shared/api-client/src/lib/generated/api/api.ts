export * from './auth-data.service';
import { AuthDataService } from './auth-data.service';
export * from './auth-data.serviceInterface';
export * from './flags-data.service';
import { FlagsDataService } from './flags-data.service';
export * from './flags-data.serviceInterface';
export * from './github-data.service';
import { GithubDataService } from './github-data.service';
export * from './github-data.serviceInterface';
export * from './health-data.service';
import { HealthDataService } from './health-data.service';
export * from './health-data.serviceInterface';
export * from './jira-data.service';
import { JiraDataService } from './jira-data.service';
export * from './jira-data.serviceInterface';
export * from './jobs-data.service';
import { JobsDataService } from './jobs-data.service';
export * from './jobs-data.serviceInterface';
export * from './linear-data.service';
import { LinearDataService } from './linear-data.service';
export * from './linear-data.serviceInterface';
export * from './slack-data.service';
import { SlackDataService } from './slack-data.service';
export * from './slack-data.serviceInterface';
export * from './standups-data.service';
import { StandupsDataService } from './standups-data.service';
export * from './standups-data.serviceInterface';
export * from './teams-data.service';
import { TeamsDataService } from './teams-data.service';
export * from './teams-data.serviceInterface';
export * from './workspaces-data.service';
import { WorkspacesDataService } from './workspaces-data.service';
export * from './workspaces-data.serviceInterface';
export const APIS = [
  AuthDataService,
  FlagsDataService,
  GithubDataService,
  HealthDataService,
  JiraDataService,
  JobsDataService,
  LinearDataService,
  SlackDataService,
  StandupsDataService,
  TeamsDataService,
  WorkspacesDataService,
];
