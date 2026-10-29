import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  email,
  form,
  FormField,
  required,
  submit,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Shell } from '@silvervibe/shared/ui';
import {
  StandupFacade,
  type TeamInviteView,
  type TeamMemberView,
} from '@silvervibe/stores/standup';
import {
  WorkspaceFacade,
  type GithubIssueView,
  type GithubRepoView,
  type JiraIssueView,
  type JiraProjectView,
  type JiraSiteView,
  type LinearProjectView,
  type SlackChannelOptionView,
  type TeamGithubTargetView,
  type TeamJiraTargetView,
  type TeamLinearProjectView,
  type TeamSlackChannelView,
} from '@silvervibe/stores/workspace';

type ConfigModel = {
  timezone: string;
  /** Local hour 0–23 as a string so Signal Forms select/input stay compatible. */
  reminderHour: string;
  reminderMinute: string;
  yesterday: string;
  today: string;
  blockers: string;
};

type InviteModel = {
  email: string;
};

@Component({
  selector: 'vs-team-admin',
  imports: [FormField, RouterLink, Shell, TranslocoPipe],
  templateUrl: './team-admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class TeamAdmin implements OnInit {
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly standup = inject(StandupFacade);

  readonly loading = this.standup.loading;
  readonly error = this.standup.error;
  readonly teams = this.standup.teams;
  readonly selectedTeamId = this.standup.selectedTeamId;
  readonly teamEntries = this.standup.teamEntries;
  readonly summary = this.standup.summary;
  readonly members = signal<TeamMemberView[]>([]);
  readonly pendingInvites = signal<TeamInviteView[]>([]);
  readonly message = signal<string | null>(null);
  readonly inviteError = signal<string | null>(null);
  readonly lastInviteLink = signal<string | null>(null);
  readonly slackChannel = signal<TeamSlackChannelView | null>(null);
  readonly slackChannels = signal<SlackChannelOptionView[]>([]);
  readonly slackChannelError = signal<string | null>(null);
  readonly slackChannelSaving = signal(false);
  readonly selectedSlackChannelId = signal('');

  readonly linearTarget = signal<TeamLinearProjectView | null>(null);
  readonly linearProjects = signal<LinearProjectView[]>([]);
  readonly linearTargetError = signal<string | null>(null);
  readonly linearTargetSaving = signal(false);
  readonly selectedLinearProjectId = signal('');

  readonly githubTarget = signal<TeamGithubTargetView | null>(null);
  readonly githubRepos = signal<GithubRepoView[]>([]);
  readonly githubIssues = signal<GithubIssueView[]>([]);
  readonly githubTargetError = signal<string | null>(null);
  readonly githubTargetSaving = signal(false);
  readonly selectedGithubRepo = signal('');
  readonly selectedGithubIssue = signal('');

  readonly jiraTarget = signal<TeamJiraTargetView | null>(null);
  readonly jiraSites = signal<JiraSiteView[]>([]);
  readonly jiraProjects = signal<JiraProjectView[]>([]);
  readonly jiraIssues = signal<JiraIssueView[]>([]);
  readonly jiraTargetError = signal<string | null>(null);
  readonly jiraTargetSaving = signal(false);
  readonly selectedJiraCloudId = signal('');
  readonly selectedJiraProject = signal('');
  readonly selectedJiraIssue = signal('');

  readonly configModel = signal<ConfigModel>({
    timezone: 'UTC',
    reminderHour: '9',
    reminderMinute: '0',
    yesterday: 'What did you do yesterday?',
    today: 'What will you do today?',
    blockers: 'Any blockers?',
  });

  readonly reminderHourOptions = Array.from({ length: 24 }, (_, h) =>
    String(h),
  );
  readonly reminderMinuteOptions = ['0', '15', '30', '45'] as const;

  readonly configForm = form(this.configModel, (schemaPath) => {
    required(schemaPath.timezone);
    required(schemaPath.reminderHour);
    required(schemaPath.reminderMinute);
  });

  readonly inviteModel = signal<InviteModel>({ email: '' });
  readonly inviteForm = form(this.inviteModel, (schemaPath) => {
    required(schemaPath.email);
    email(schemaPath.email);
  });

  async ngOnInit(): Promise<void> {
    await this.workspaces.loadMyWorkspaces();
    const ws = this.workspaces.selectedWorkspace();
    if (!ws) {
      return;
    }
    await this.standup.loadMyTeams(ws.id);
    const teamId = this.standup.selectedTeamId();
    if (teamId) {
      await this.refreshTeam(teamId);
    }
  }

  async onTeamChange(teamId: string): Promise<void> {
    this.standup.selectTeam(teamId);
    await this.refreshTeam(teamId);
  }

  private async refreshTeam(teamId: string): Promise<void> {
    await this.standup.loadTeamAdmin(teamId);
    const config = this.standup.config();
    if (config) {
      const snappedMinute = String(
        this.reminderMinuteOptions.find(
          (m) => Number(m) === config.reminderMinute,
        ) ?? Math.min(45, Math.floor(config.reminderMinute / 15) * 15),
      );
      this.configModel.set({
        timezone: config.timezone,
        reminderHour: String(
          Math.min(23, Math.max(0, Math.trunc(config.reminderHour))),
        ),
        reminderMinute: snappedMinute,
        yesterday: config.questionsJson['yesterday'] ?? '',
        today: config.questionsJson['today'] ?? '',
        blockers: config.questionsJson['blockers'] ?? '',
      });
    }
    const [members, invites] = await Promise.all([
      this.standup.listMembers(teamId),
      this.standup.listInvites(teamId),
    ]);
    this.members.set(members);
    this.pendingInvites.set(invites);
    await Promise.all([
      this.refreshSlackChannel(teamId),
      this.refreshLinearTarget(teamId),
      this.refreshGithubTarget(teamId),
      this.refreshJiraTarget(teamId),
    ]);
  }

  private async refreshSlackChannel(teamId: string): Promise<void> {
    this.slackChannelError.set(null);
    try {
      const channel = await this.workspaces.getTeamSlackChannel(teamId);
      this.slackChannel.set(channel);
      this.selectedSlackChannelId.set(channel.channelId ?? '');
      if (channel.slackConnected) {
        const channels = await this.workspaces.listTeamSlackChannels(teamId);
        this.slackChannels.set(channels);
      } else {
        this.slackChannels.set([]);
      }
    } catch (err: unknown) {
      this.slackChannel.set(null);
      this.slackChannels.set([]);
      this.slackChannelError.set(
        err instanceof Error ? err.message : 'Slack channel unavailable',
      );
    }
  }

  async saveSlackChannel(): Promise<void> {
    const teamId = this.selectedTeamId();
    const channelId = this.selectedSlackChannelId().trim();
    if (!teamId || !channelId) {
      return;
    }
    this.slackChannelSaving.set(true);
    this.slackChannelError.set(null);
    try {
      const label =
        this.slackChannels().find((c) => c.id === channelId)?.label ??
        undefined;
      const channel = await this.workspaces.setTeamSlackChannel(teamId, {
        channelId,
        channelLabel: label,
      });
      this.slackChannel.set(channel);
      this.selectedSlackChannelId.set(channel.channelId ?? '');
      this.message.set('standup.team.slackChannelSaved');
    } catch (err: unknown) {
      this.slackChannelError.set(
        err instanceof Error ? err.message : 'Could not save Slack channel',
      );
    } finally {
      this.slackChannelSaving.set(false);
    }
  }

  async clearSlackChannel(): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.slackChannelSaving.set(true);
    this.slackChannelError.set(null);
    try {
      const channel = await this.workspaces.clearTeamSlackChannel(teamId);
      this.slackChannel.set(channel);
      this.selectedSlackChannelId.set(channel.channelId ?? '');
      this.message.set('standup.team.slackChannelCleared');
    } catch (err: unknown) {
      this.slackChannelError.set(
        err instanceof Error ? err.message : 'Could not clear Slack channel',
      );
    } finally {
      this.slackChannelSaving.set(false);
    }
  }

  private async refreshLinearTarget(teamId: string): Promise<void> {
    this.linearTargetError.set(null);
    try {
      const target = await this.workspaces.getTeamLinearProject(teamId);
      this.linearTarget.set(target);
      this.selectedLinearProjectId.set(target.projectId ?? '');
      if (target.linearConnected) {
        const projects = await this.workspaces.listTeamLinearProjects(teamId);
        this.linearProjects.set(projects);
      } else {
        this.linearProjects.set([]);
      }
    } catch (err: unknown) {
      this.linearTarget.set(null);
      this.linearProjects.set([]);
      this.linearTargetError.set(
        err instanceof Error ? err.message : 'Linear project unavailable',
      );
    }
  }

  async saveLinearTarget(): Promise<void> {
    const teamId = this.selectedTeamId();
    const projectId = this.selectedLinearProjectId().trim();
    if (!teamId || !projectId) {
      return;
    }
    this.linearTargetSaving.set(true);
    this.linearTargetError.set(null);
    try {
      const target = await this.workspaces.setTeamLinearProject(teamId, {
        projectId,
      });
      this.linearTarget.set(target);
      this.selectedLinearProjectId.set(target.projectId ?? '');
      this.message.set('standup.team.linearTargetSaved');
    } catch (err: unknown) {
      this.linearTargetError.set(
        err instanceof Error ? err.message : 'Could not save Linear project',
      );
    } finally {
      this.linearTargetSaving.set(false);
    }
  }

  async clearLinearTarget(): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.linearTargetSaving.set(true);
    this.linearTargetError.set(null);
    try {
      const target = await this.workspaces.clearTeamLinearProject(teamId);
      this.linearTarget.set(target);
      this.selectedLinearProjectId.set(target.projectId ?? '');
      this.message.set('standup.team.linearTargetCleared');
    } catch (err: unknown) {
      this.linearTargetError.set(
        err instanceof Error ? err.message : 'Could not clear Linear project',
      );
    } finally {
      this.linearTargetSaving.set(false);
    }
  }

  private async refreshGithubTarget(teamId: string): Promise<void> {
    this.githubTargetError.set(null);
    try {
      const target = await this.workspaces.getTeamGithubTarget(teamId);
      this.githubTarget.set(target);
      const fullName =
        target.owner && target.repo ? `${target.owner}/${target.repo}` : '';
      this.selectedGithubRepo.set(fullName);
      this.selectedGithubIssue.set(
        target.issueNumber != null ? String(target.issueNumber) : '',
      );
      if (target.githubConnected) {
        const repos = await this.workspaces.listTeamGithubRepos(teamId);
        this.githubRepos.set(repos);
        if (target.owner && target.repo) {
          const issues = await this.workspaces.listTeamGithubIssues(
            teamId,
            target.owner,
            target.repo,
          );
          this.githubIssues.set(issues);
        } else {
          this.githubIssues.set([]);
        }
      } else {
        this.githubRepos.set([]);
        this.githubIssues.set([]);
      }
    } catch (err: unknown) {
      this.githubTarget.set(null);
      this.githubRepos.set([]);
      this.githubIssues.set([]);
      this.githubTargetError.set(
        err instanceof Error ? err.message : 'GitHub target unavailable',
      );
    }
  }

  async onGithubRepoChange(fullName: string): Promise<void> {
    this.selectedGithubRepo.set(fullName);
    this.selectedGithubIssue.set('');
    this.githubIssues.set([]);
    const teamId = this.selectedTeamId();
    const slash = fullName.indexOf('/');
    if (!teamId || slash <= 0) {
      return;
    }
    const owner = fullName.slice(0, slash);
    const repo = fullName.slice(slash + 1);
    try {
      const issues = await this.workspaces.listTeamGithubIssues(
        teamId,
        owner,
        repo,
      );
      this.githubIssues.set(issues);
    } catch (err: unknown) {
      this.githubTargetError.set(
        err instanceof Error ? err.message : 'Could not load GitHub issues',
      );
    }
  }

  async saveGithubTarget(): Promise<void> {
    const teamId = this.selectedTeamId();
    const fullName = this.selectedGithubRepo().trim();
    const issueRaw = this.selectedGithubIssue().trim();
    const slash = fullName.indexOf('/');
    const issueNumber = Number(issueRaw);
    if (
      !teamId ||
      slash <= 0 ||
      !Number.isFinite(issueNumber) ||
      issueNumber < 1
    ) {
      return;
    }
    this.githubTargetSaving.set(true);
    this.githubTargetError.set(null);
    try {
      const target = await this.workspaces.setTeamGithubTarget(teamId, {
        owner: fullName.slice(0, slash),
        repo: fullName.slice(slash + 1),
        issueNumber,
      });
      this.githubTarget.set(target);
      this.selectedGithubRepo.set(
        target.owner && target.repo ? `${target.owner}/${target.repo}` : '',
      );
      this.selectedGithubIssue.set(
        target.issueNumber != null ? String(target.issueNumber) : '',
      );
      this.message.set('standup.team.githubTargetSaved');
    } catch (err: unknown) {
      this.githubTargetError.set(
        err instanceof Error ? err.message : 'Could not save GitHub target',
      );
    } finally {
      this.githubTargetSaving.set(false);
    }
  }

  async clearGithubTarget(): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.githubTargetSaving.set(true);
    this.githubTargetError.set(null);
    try {
      const target = await this.workspaces.clearTeamGithubTarget(teamId);
      this.githubTarget.set(target);
      this.selectedGithubRepo.set(
        target.owner && target.repo ? `${target.owner}/${target.repo}` : '',
      );
      this.selectedGithubIssue.set(
        target.issueNumber != null ? String(target.issueNumber) : '',
      );
      this.message.set('standup.team.githubTargetCleared');
    } catch (err: unknown) {
      this.githubTargetError.set(
        err instanceof Error ? err.message : 'Could not clear GitHub target',
      );
    } finally {
      this.githubTargetSaving.set(false);
    }
  }

  private async refreshJiraTarget(teamId: string): Promise<void> {
    this.jiraTargetError.set(null);
    try {
      const target = await this.workspaces.getTeamJiraTarget(teamId);
      this.jiraTarget.set(target);
      const cloudId = target.cloudId ?? target.workspaceCloudId ?? '';
      this.selectedJiraCloudId.set(cloudId);
      this.selectedJiraProject.set(target.projectKey ?? '');
      this.selectedJiraIssue.set(target.issueKey ?? '');
      if (target.jiraConnected) {
        const sites = await this.workspaces.listTeamJiraSites(teamId);
        this.jiraSites.set(sites);
        if (cloudId) {
          const projects = await this.workspaces.listTeamJiraProjects(
            teamId,
            cloudId,
          );
          this.jiraProjects.set(projects);
          if (target.projectKey) {
            const issues = await this.workspaces.listTeamJiraIssues(
              teamId,
              target.projectKey,
              cloudId,
            );
            this.jiraIssues.set(issues);
          } else {
            this.jiraIssues.set([]);
          }
        } else {
          this.jiraProjects.set([]);
          this.jiraIssues.set([]);
        }
      } else {
        this.jiraSites.set([]);
        this.jiraProjects.set([]);
        this.jiraIssues.set([]);
      }
    } catch (err: unknown) {
      this.jiraTarget.set(null);
      this.jiraSites.set([]);
      this.jiraProjects.set([]);
      this.jiraIssues.set([]);
      this.jiraTargetError.set(
        err instanceof Error ? err.message : 'Jira target unavailable',
      );
    }
  }

  async onJiraSiteChange(cloudId: string): Promise<void> {
    this.selectedJiraCloudId.set(cloudId);
    this.selectedJiraProject.set('');
    this.selectedJiraIssue.set('');
    this.jiraProjects.set([]);
    this.jiraIssues.set([]);
    const teamId = this.selectedTeamId();
    if (!teamId || !cloudId.trim()) {
      return;
    }
    try {
      const projects = await this.workspaces.listTeamJiraProjects(
        teamId,
        cloudId.trim(),
      );
      this.jiraProjects.set(projects);
    } catch (err: unknown) {
      this.jiraTargetError.set(
        err instanceof Error ? err.message : 'Could not load Jira projects',
      );
    }
  }

  async onJiraProjectChange(projectKey: string): Promise<void> {
    this.selectedJiraProject.set(projectKey);
    this.selectedJiraIssue.set('');
    this.jiraIssues.set([]);
    const teamId = this.selectedTeamId();
    const cloudId = this.selectedJiraCloudId().trim();
    if (!teamId || !projectKey.trim() || !cloudId) {
      return;
    }
    try {
      const issues = await this.workspaces.listTeamJiraIssues(
        teamId,
        projectKey.trim(),
        cloudId,
      );
      this.jiraIssues.set(issues);
    } catch (err: unknown) {
      this.jiraTargetError.set(
        err instanceof Error ? err.message : 'Could not load Jira issues',
      );
    }
  }

  async saveJiraTarget(): Promise<void> {
    const teamId = this.selectedTeamId();
    const projectKey = this.selectedJiraProject().trim();
    const issueKey = this.selectedJiraIssue().trim();
    const cloudId = this.selectedJiraCloudId().trim();
    if (!teamId || !cloudId || !projectKey || !issueKey) {
      return;
    }
    this.jiraTargetSaving.set(true);
    this.jiraTargetError.set(null);
    try {
      const next = await this.workspaces.setTeamJiraTarget(teamId, {
        cloudId,
        projectKey,
        issueKey,
      });
      this.jiraTarget.set(next);
      this.selectedJiraCloudId.set(next.cloudId ?? '');
      this.selectedJiraProject.set(next.projectKey ?? '');
      this.selectedJiraIssue.set(next.issueKey ?? '');
      this.message.set('standup.team.jiraTargetSaved');
    } catch (err: unknown) {
      this.jiraTargetError.set(
        err instanceof Error ? err.message : 'Could not save Jira target',
      );
    } finally {
      this.jiraTargetSaving.set(false);
    }
  }

  async clearJiraTarget(): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.jiraTargetSaving.set(true);
    this.jiraTargetError.set(null);
    try {
      const next = await this.workspaces.clearTeamJiraTarget(teamId);
      this.jiraTarget.set(next);
      this.selectedJiraCloudId.set(next.cloudId ?? next.workspaceCloudId ?? '');
      this.selectedJiraProject.set(next.projectKey ?? '');
      this.selectedJiraIssue.set(next.issueKey ?? '');
      this.message.set('standup.team.jiraTargetCleared');
      if (teamId && this.selectedJiraCloudId()) {
        const projects = await this.workspaces.listTeamJiraProjects(
          teamId,
          this.selectedJiraCloudId(),
        );
        this.jiraProjects.set(projects);
        if (next.projectKey) {
          const issues = await this.workspaces.listTeamJiraIssues(
            teamId,
            next.projectKey,
            this.selectedJiraCloudId(),
          );
          this.jiraIssues.set(issues);
        } else {
          this.jiraIssues.set([]);
        }
      }
    } catch (err: unknown) {
      this.jiraTargetError.set(
        err instanceof Error ? err.message : 'Could not clear Jira target',
      );
    } finally {
      this.jiraTargetSaving.set(false);
    }
  }

  async saveConfig(event: Event): Promise<void> {
    event.preventDefault();
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    await submit(this.configForm, {
      action: async () => {
        const m = this.configModel();
        await this.standup.saveConfig(teamId, {
          timezone: m.timezone,
          reminderHour: Math.min(
            23,
            Math.max(0, Math.trunc(Number(m.reminderHour)) || 0),
          ),
          reminderMinute: Math.min(
            45,
            Math.max(0, Math.trunc(Number(m.reminderMinute)) || 0),
          ),
          questionsJson: {
            yesterday: m.yesterday,
            today: m.today,
            blockers: m.blockers,
          },
        });
        this.message.set('standup.team.saved');
        return undefined;
      },
    });
  }

  async invite(event: Event): Promise<void> {
    event.preventDefault();
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    this.inviteError.set(null);
    this.lastInviteLink.set(null);
    await submit(this.inviteForm, {
      action: async () => {
        try {
          const result = await this.standup.inviteByEmail(
            teamId,
            this.inviteModel().email.trim(),
          );
          this.inviteModel.set({ email: '' });
          if (result.status === 'ACCEPTED') {
            this.message.set('standup.team.inviteAccepted');
            this.inviteError.set(null);
          } else {
            this.message.set(
              result.emailSent
                ? 'standup.team.inviteEmailSent'
                : 'standup.team.invitePending',
            );
            this.inviteError.set(
              result.emailSent ? null : (result.emailError ?? null),
            );
            this.lastInviteLink.set(
              `${window.location.origin}${result.acceptPath}`,
            );
          }
          await this.refreshTeam(teamId);
        } catch (err: unknown) {
          this.inviteError.set(
            err instanceof Error ? err.message : 'Invite failed',
          );
        }
        return undefined;
      },
    });
  }

  async copyInviteLink(path: string): Promise<void> {
    const url = path.startsWith('http')
      ? path
      : `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      this.message.set('standup.team.linkCopied');
      this.lastInviteLink.set(url);
    } catch {
      this.lastInviteLink.set(url);
    }
  }

  async revokeInvite(inviteId: string): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    await this.standup.revokeInvite(teamId, inviteId);
    this.message.set('standup.team.inviteRevoked');
    await this.refreshTeam(teamId);
  }

  async rebuildSummary(): Promise<void> {
    const teamId = this.selectedTeamId();
    if (!teamId) {
      return;
    }
    await this.standup.refreshSummary(teamId);
  }
}
