import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { provideSilvervibeApiClient } from '@silvervibe/shared/api-client';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { of } from 'rxjs';
import { WorkspaceAdmin } from './workspace-admin';

describe('WorkspaceAdmin', () => {
  let fixture: ComponentFixture<WorkspaceAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkspaceAdmin],
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
                portal: { workspace: 'Workspace' },
                standup: {
                  loading: 'Loading',
                  nav: {
                    myStandup: 'My standup',
                    teamAdmin: 'Team',
                    workspace: 'Workspace',
                  },
                  workspace: {
                    title: 'Workspace admin',
                    lead: 'Manage tools and teams',
                    forbidden: 'Admins only',
                    tools: 'Tools',
                    createTeam: 'Create team',
                    teamName: 'Name',
                    teamSlug: 'Slug',
                    create: 'Create',
                    toolUpdated: 'Updated',
                    teamCreated: 'Created',
                    planTitle: 'Workspace plan',
                    planStatus: 'Current plan {{plan}}',
                    upgradeToTeam: 'Upgrade to Team',
                    planUpgraded: 'Upgraded',
                    slackTitle: 'Slack',
                    slackHint: 'Connect Slack',
                    slackStatus: 'Status',
                    slackConnect: 'Connect Slack',
                    slackDisconnect: 'Disconnect',
                    slackConnected: 'Connected',
                    slackDisconnected: 'Disconnected',
                    slackOAuthUnavailable: 'OAuth unavailable',
                    linearTitle: 'Linear',
                    linearHint: 'Connect Linear',
                    linearStatus: 'Status',
                    linearConnect: 'Connect Linear',
                    linearDisconnect: 'Disconnect',
                    linearConnected: 'Connected',
                    linearDisconnected: 'Disconnected',
                    linearProjectSaved: 'Project saved',
                    linearProject: 'Project',
                    linearProjectPlaceholder: 'Select…',
                    linearOAuthUnavailable: 'OAuth unavailable',
                    githubTitle: 'GitHub',
                    githubHint: 'Connect GitHub',
                    githubStatus: 'Status',
                    githubConnect: 'Connect GitHub',
                    githubDisconnect: 'Disconnect',
                    githubConnected: 'Connected',
                    githubDisconnected: 'Disconnected',
                    githubTargetSaved: 'Target saved',
                    githubRepo: 'Repo',
                    githubRepoPlaceholder: 'Select…',
                    githubIssue: 'Issue',
                    githubIssuePlaceholder: 'Select…',
                    githubOAuthUnavailable: 'OAuth unavailable',
                    gitlabTitle: 'GitLab',
                    gitlabHint: 'Connect GitLab',
                    gitlabStatus: 'Status',
                    gitlabConnect: 'Connect GitLab',
                    gitlabDisconnect: 'Disconnect GitLab',
                    gitlabConnected: 'GitLab connected',
                    gitlabDisconnected: 'GitLab disconnected',
                    gitlabOAuthUnavailable: 'OAuth unavailable',
                    bitbucketTitle: 'Bitbucket',
                    bitbucketHint: 'Connect Bitbucket',
                    bitbucketStatus: 'Status',
                    bitbucketConnect: 'Connect Bitbucket',
                    bitbucketDisconnect: 'Disconnect Bitbucket',
                    bitbucketConnected: 'Bitbucket connected',
                    bitbucketDisconnected: 'Bitbucket disconnected',
                    bitbucketOAuthUnavailable: 'OAuth unavailable',
                    trelloTitle: 'Trello',
                    trelloHint: 'Connect Trello',
                    trelloStatus: 'Status',
                    trelloConnect: 'Connect Trello',
                    trelloDisconnect: 'Disconnect Trello',
                    trelloConnected: 'Trello connected',
                    trelloDisconnected: 'Trello disconnected',
                    trelloOAuthUnavailable: 'OAuth unavailable',
                    jiraTitle: 'Jira',
                    jiraHint: 'Connect Jira',
                    jiraStatus: 'Status',
                    jiraConnect: 'Connect Jira',
                    jiraDisconnect: 'Disconnect',
                    jiraConnected: 'Connected',
                    jiraDisconnected: 'Disconnected',
                    jiraTargetSaved: 'Target saved',
                    jiraSite: 'Site',
                    jiraSitePlaceholder: 'Select…',
                    jiraProject: 'Project',
                    jiraProjectPlaceholder: 'Select…',
                    jiraIssue: 'Issue',
                    jiraIssuePlaceholder: 'Select…',
                    jiraOAuthUnavailable: 'OAuth unavailable',
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
    fixture = TestBed.createComponent(WorkspaceAdmin);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/me/workspaces')
      .flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the workspace admin title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Workspace admin');
  });

  it('keeps the workspace selector when selected membership is MEMBER', async () => {
    const http = TestBed.inject(HttpTestingController);
    const load = fixture.componentInstance['workspaces'].loadMyWorkspaces();
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws-member',
        name: 'Member WS',
        slug: 'member',
        planKey: 'free',
        role: 'MEMBER',
        tools: [],
      },
      {
        id: 'ws-admin',
        name: 'Admin WS',
        slug: 'admin',
        planKey: 'free',
        role: 'OWNER',
        tools: [{ toolKey: 'vibestandup', enabled: true }],
      },
    ]);
    await load;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Member WS');
    expect(el.textContent).toContain('Admin WS');
    expect(el.querySelector('fieldset select')).toBeTruthy();
    expect(el.textContent).toContain('Admins only');
  });

  it('starts GitLab OAuth when Connect GitLab is clicked', async () => {
    const http = TestBed.inject(HttpTestingController);
    const open = vi
      .spyOn(fixture.componentInstance, 'openAuthorizeUrl')
      .mockImplementation(() => undefined);
    const load = fixture.componentInstance['workspaces'].loadMyWorkspaces();
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws-admin',
        name: 'Admin WS',
        slug: 'admin',
        planKey: 'free',
        role: 'OWNER',
        tools: [],
      },
    ]);
    await load;
    fixture.componentInstance.gitlab.set({
      status: 'DISCONNECTED',
      configured: false,
      accountLogin: null,
      toolEnabled: false,
      oauthAvailable: true,
    });
    fixture.detectChanges();

    const button = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ].find((item) => item.textContent?.includes('Connect GitLab'));
    expect(button).toBeTruthy();
    button?.click();

    const start = http.expectOne(
      '/api/workspaces/ws-admin/addons/gitlab/oauth/start',
    );
    expect(start.request.method).toBe('GET');
    start.flush({
      authorizeUrl: 'https://gitlab.com/oauth/authorize?client_id=app',
    });
    await fixture.whenStable();
    expect(open).toHaveBeenCalledWith(
      'https://gitlab.com/oauth/authorize?client_id=app',
    );
  });

  it('starts Bitbucket OAuth when Connect Bitbucket is clicked', async () => {
    const http = TestBed.inject(HttpTestingController);
    const open = vi
      .spyOn(fixture.componentInstance, 'openAuthorizeUrl')
      .mockImplementation(() => undefined);
    const load = fixture.componentInstance['workspaces'].loadMyWorkspaces();
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws-admin',
        name: 'Admin WS',
        slug: 'admin',
        planKey: 'free',
        role: 'OWNER',
        tools: [],
      },
    ]);
    await load;
    fixture.componentInstance.bitbucket.set({
      status: 'DISCONNECTED',
      configured: false,
      accountLogin: null,
      toolEnabled: false,
      oauthAvailable: true,
    });
    fixture.detectChanges();

    const button = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ].find((item) => item.textContent?.includes('Connect Bitbucket'));
    expect(button).toBeTruthy();
    button?.click();

    const start = http.expectOne(
      '/api/workspaces/ws-admin/addons/bitbucket/oauth/start',
    );
    expect(start.request.method).toBe('GET');
    start.flush({
      authorizeUrl: 'https://bitbucket.org/site/oauth2/authorize?client_id=app',
    });
    await fixture.whenStable();
    expect(open).toHaveBeenCalledWith(
      'https://bitbucket.org/site/oauth2/authorize?client_id=app',
    );
  });

  it('starts Trello OAuth when Connect Trello is clicked', async () => {
    const http = TestBed.inject(HttpTestingController);
    const open = vi
      .spyOn(fixture.componentInstance, 'openAuthorizeUrl')
      .mockImplementation(() => undefined);
    const load = fixture.componentInstance['workspaces'].loadMyWorkspaces();
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws-admin',
        name: 'Admin WS',
        slug: 'admin',
        planKey: 'free',
        role: 'OWNER',
        tools: [],
      },
    ]);
    await load;
    fixture.componentInstance.trello.set({
      status: 'DISCONNECTED',
      configured: false,
      accountLogin: null,
      toolEnabled: false,
      oauthAvailable: true,
    });
    fixture.detectChanges();

    const button = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ].find((item) => item.textContent?.includes('Connect Trello'));
    expect(button).toBeTruthy();
    button?.click();

    const start = http.expectOne(
      '/api/workspaces/ws-admin/addons/trello/oauth/start',
    );
    expect(start.request.method).toBe('GET');
    start.flush({
      authorizeUrl: 'https://auth.atlassian.com/authorize?client_id=app',
    });
    await fixture.whenStable();
    expect(open).toHaveBeenCalledWith(
      'https://auth.atlassian.com/authorize?client_id=app',
    );
  });
});
