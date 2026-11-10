import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { provideSilvervibeApiClient } from '@silvervibe/shared/api-client';
import { API_BASE_URL, FeatureFlagsService } from '@silvervibe/shared/auth';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { StandupFacade } from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { of } from 'rxjs';
import { addonFailure, TeamAdmin } from './team-admin';

describe('TeamAdmin', () => {
  let fixture: ComponentFixture<TeamAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamAdmin],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        provideSilvervibeApiClient(),
        { provide: PREVIEW_SWITCHER_EMAILS, useValue: [] },
        {
          provide: PREVIEW_SWITCHER_USER_EMAIL,
          useValue: signal<string | null>(null),
        },
        WorkspaceFacade,
        StandupFacade,
        {
          provide: FeatureFlagsService,
          useValue: { isEnabled: () => Promise.resolve(false) },
        },
        ...provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
          },
          loader: class {
            getTranslation() {
              return of({
                nav: { account: 'Account' },
                standup: {
                  loading: 'Loading',
                  nav: {
                    myStandup: 'My standup',
                    teamAdmin: 'Team',
                    workspace: 'Workspace',
                  },
                  my: { team: 'Team' },
                  team: {
                    title: 'Team admin',
                    lead: 'Configure standup',
                    noTeams: 'No teams',
                    posted: 'Posted',
                    stillOpen: 'Still open',
                    away: 'Away',
                    config: 'Config',
                    timezone: 'Timezone',
                    reminderHour: 'Reminder hour',
                    reminderMinute: 'Reminder minute',
                    reminderHint: '15-minute window',
                    saveConfig: 'Save',
                    saved: 'Saved',
                    members: 'Members',
                    inviteUserId: 'User id',
                    inviteEmail: 'Email',
                    invite: 'Invite',
                    inviteEmailHint: 'Email when configured',
                    pendingInvites: 'Pending',
                    copyLink: 'Copy',
                    revoke: 'Revoke',
                    shareLink: 'Share',
                    invitePending: 'Pending',
                    inviteEmailSent: 'Email sent',
                    inviteAccepted: 'Accepted',
                    inviteRevoked: 'Revoked',
                    linkCopied: 'Copied',
                    todayEntries: 'Today',
                    rebuildSummary: 'Rebuild',
                    slackChannelTitle: 'Slack channel',
                    slackChannelHint: 'Override channel',
                    slackNotConnected: 'Not connected',
                    slackChannel: 'Channel',
                    slackChannelDefault: 'Default',
                    slackChannelOverride: 'Override',
                    slackChannelSave: 'Save channel',
                    slackChannelClear: 'Clear',
                    slackChannelSaved: 'Saved channel',
                    slackChannelCleared: 'Cleared channel',
                    targetDefault: 'Default',
                    targetOverride: 'Override',
                    targetSave: 'Save',
                    targetClear: 'Clear',
                    linearTargetTitle: 'Linear',
                    linearTargetHint: 'Override Linear',
                    linearNotConnected: 'Linear not connected',
                    linearProject: 'Project',
                    linearTargetSaved: 'Linear saved',
                    linearTargetCleared: 'Linear cleared',
                    githubTargetTitle: 'GitHub',
                    githubTargetHint: 'Override GitHub',
                    githubNotConnected: 'GitHub not connected',
                    githubRepo: 'Repo',
                    githubIssue: 'Issue',
                    githubTargetSaved: 'GitHub saved',
                    githubTargetCleared: 'GitHub cleared',
                    jiraTargetTitle: 'Jira',
                    jiraTargetHint: 'Override Jira',
                    jiraNotConnected: 'Jira not connected',
                    jiraSite: 'Site',
                    jiraProject: 'Project',
                    jiraIssue: 'Issue',
                    jiraTargetSaved: 'Jira saved',
                    jiraTargetCleared: 'Jira cleared',
                    publishTitle: 'Also post the summary',
                    publishGithub: 'Post the summary to GitHub',
                  },
                  invite: {
                    title: 'Join',
                    accepting: '…',
                    success: 'ok',
                    goStandup: 'go',
                    signIn: 'in',
                    missingToken: 'missing',
                    acceptFailed: 'fail',
                  },
                },
                shell: {
                  theme: { toDark: 'Dark', toLight: 'Light' },
                },
                common: { language: { label: 'Language', en: 'English' } },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TeamAdmin);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/me/workspaces')
      .flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows posted, open, and away members', async () => {
    const http = TestBed.inject(HttpTestingController);
    const pending = TestBed.inject(StandupFacade).loadMyTeams('ws1');
    http
      .expectOne('/api/workspaces/ws1/teams/mine')
      .flush([{ id: 't1', name: 'Alpha', slug: 'alpha', role: 'ADMIN' }]);
    await pending;
    fixture.componentInstance.roster.set([
      { userId: 'u1', name: 'Ada', status: 'posted', today: 'Ship the API' },
      { userId: 'u2', name: 'Bea', status: 'open', today: null },
      { userId: 'u3', name: 'Cal', status: 'away', today: null },
    ]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Ada');
    expect(text).toContain('Posted');
    expect(text).toContain('Ship the API');
    expect(text).toContain('Bea');
    expect(text).toContain('Still open');
    expect(text).toContain('Cal');
    expect(text).toContain('Away');
  });

  it('renders the team admin title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Team admin');
  });

  it('asks to reconnect when a stored token is rejected', () => {
    expect(
      addonFailure(
        new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }),
        'GitHub target unavailable',
      ),
    ).toEqual({
      message: 'standup.team.reconnectAddon',
      reconnect: true,
      status: 401,
    });
    expect(
      addonFailure(new Error('rate limited'), 'GitHub target unavailable'),
    ).toEqual({ message: 'rate limited', reconnect: false });
    expect(addonFailure('nope', 'Jira target unavailable')).toEqual({
      message: 'Jira target unavailable',
      reconnect: false,
    });
    expect(
      addonFailure(
        new HttpErrorResponse({
          status: 400,
          statusText: 'Bad Request',
          error: { message: 'GitHub repository not found' },
        }),
        'standup.workspace.githubRequestFailed',
      ),
    ).toEqual({
      message: 'GitHub repository not found',
      reconnect: false,
      status: 400,
    });
  });

  it('shows summary posting on the digests tab only when the flag is on', async () => {
    const http = TestBed.inject(HttpTestingController);
    const pending = TestBed.inject(StandupFacade).loadMyTeams('ws1');
    http
      .expectOne('/api/workspaces/ws1/teams/mine')
      .flush([{ id: 't1', name: 'Alpha', slug: 'alpha', role: 'ADMIN' }]);
    await pending;
    fixture.componentInstance.adminSection.set('digests');
    fixture.detectChanges();
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).not.toContain('Also post the summary');
    fixture.componentInstance.digestPublishEnabled.set(true);
    fixture.detectChanges();
    expect(text()).toContain('Also post the summary');
    expect(text()).toContain('Post the summary to GitHub');
    fixture.componentInstance.setPublish('publishGithub', true);
    expect(fixture.componentInstance.configModel().publishGithub).toBe(true);
    expect(fixture.componentInstance.configModel().publishJira).toBe(false);
    expect(fixture.componentInstance.configModel().publishLinear).toBe(false);
  });

  it('adds a custom text question', () => {
    fixture.componentInstance.addQuestion('text');
    const added = fixture.componentInstance
      .questions()
      .find((question) => question.type === 'text' && !question.builtin);
    expect(added?.enabled).toBe(true);
  });
});
