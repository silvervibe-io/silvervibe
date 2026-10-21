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
                    slackTitle: 'Slack',
                    slackHint: 'Webhook',
                    slackStatus: 'Status',
                    slackWebhook: 'URL',
                    slackChannel: 'Channel',
                    slackConnect: 'Connect',
                    slackDisconnect: 'Disconnect',
                    slackConnected: 'Connected',
                    slackDisconnected: 'Disconnected',
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
});
