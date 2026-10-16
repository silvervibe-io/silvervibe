import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { StandupStore } from '@silvervibe/stores/standup';
import { WorkspaceStore } from '@silvervibe/stores/workspace';
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
        WorkspaceStore,
        StandupStore,
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
                    invite: 'Invite',
                    todayEntries: 'Today',
                    rebuildSummary: 'Rebuild',
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
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the team admin title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Team admin');
  });
});
