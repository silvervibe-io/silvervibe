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
import { StandupFacade } from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { of } from 'rxjs';
import { TeamAdmin } from './team-admin';

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
                    config: 'Config',
                    timezone: 'Timezone',
                    saveConfig: 'Save',
                    saved: 'Saved',
                    members: 'Members',
                    inviteUserId: 'User id',
                    inviteEmail: 'Email',
                    invite: 'Invite',
                    pendingInvites: 'Pending',
                    copyLink: 'Copy',
                    revoke: 'Revoke',
                    shareLink: 'Share',
                    invitePending: 'Pending',
                    inviteAccepted: 'Accepted',
                    inviteRevoked: 'Revoked',
                    linkCopied: 'Copied',
                    todayEntries: 'Today',
                    rebuildSummary: 'Rebuild',
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

  it('renders the team admin title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Team admin');
  });
});
