import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTransloco } from '@jsverse/transloco';
import { provideSilvervibeApiClient } from '@silvervibe/shared/api-client';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { defaultWeek, StandupFacade } from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MyStandup } from './my-standup';

describe('MyStandup', () => {
  let fixture: ComponentFixture<MyStandup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyStandup],
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
                  my: {
                    title: 'My standup',
                    lead: 'Share updates',
                    noTeams: 'No teams',
                    team: 'Team',
                    yesterday: 'Yesterday',
                    today: 'Today',
                    blockers: 'Blockers',
                    saveDraft: 'Save draft',
                    submit: 'Submit',
                    submitted: 'Submitted',
                    summary: 'Summary',
                    recentDays: 'Recent days',
                    noSummary: 'No summary for this day.',
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
    fixture = TestBed.createComponent(MyStandup);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/me/workspaces')
      .flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('saves an away day and reads it back', async () => {
    const component = fixture.componentInstance;
    const facade = TestBed.inject(StandupFacade);
    facade.selectTeam('team-1');
    component.awayDates.set(['2026-11-06']);
    expect(component.isAway('2026-11-06')).toBe(true);
    expect(component.isAway('2026-11-07')).toBe(false);
    expect(component.awayDays()).toHaveLength(7);
    vi.spyOn(facade, 'setAway').mockResolvedValue(['2026-11-07']);
    await component.toggleAway('2026-11-07', true);
    expect(facade.setAway).toHaveBeenCalledWith('team-1', '2026-11-07', true);
    expect(component.isAway('2026-11-07')).toBe(true);
  });

  it('switches recent days and shows an empty summary', async () => {
    const http = TestBed.inject(HttpTestingController);
    const pending = TestBed.inject(StandupFacade).loadMyTeams('ws1');
    http
      .expectOne('/api/workspaces/ws1/teams/mine')
      .flush([{ id: 't1', name: 'Alpha', slug: 'alpha', role: 'MEMBER' }]);
    await pending;
    const component = fixture.componentInstance;
    component.recentDays.set([
      { entryDate: '2026-11-06', content: null },
      {
        entryDate: '2026-11-05',
        content: '### Needs help\n- Waiting on a key',
      },
    ]);
    component.selectedSummaryDate.set('2026-11-06');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No summary for this day.');
    component.selectedSummaryDate.set('2026-11-05');
    fixture.detectChanges();
    expect(el.textContent).toContain('Waiting on a key');
    expect(component.selectedSummary()?.entryDate).toBe('2026-11-05');
  });

  it('renders the my standup title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('My standup');
  });

  it('inserts a person token from an @ mention', () => {
    const component = fixture.componentInstance;
    component.members.set([
      {
        id: 'm1',
        userId: 'user_1',
        role: 'MEMBER',
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        timezone: 'UTC',
        workHours: defaultWeek(),
      },
    ]);
    component.rows.set([
      { questionId: 'today', text: '@ad', optionId: '', otherText: '' },
    ]);
    const textarea = document.createElement('textarea');
    textarea.value = '@ad';
    textarea.selectionStart = 3;
    component.onAnswerInput('today', { target: textarea } as unknown as Event);
    expect(component.mentionChoices().map((choice) => choice.label)).toEqual([
      'Ada Lovelace',
    ]);
    component.onAnswerKeydown('today', {
      key: 'Enter',
      preventDefault() {
        return undefined;
      },
      target: textarea,
    } as unknown as KeyboardEvent);
    expect(component.rows()[0]?.text).toBe('@Ada Lovelace ');
  });

  it('inserts an issue link from a # mention', async () => {
    const component = fixture.componentInstance;
    const facade = TestBed.inject(StandupFacade);
    facade.selectTeam('team-1');
    vi.spyOn(facade, 'searchIssues').mockResolvedValue([
      {
        provider: 'jira',
        key: 'PROJ-12',
        title: 'Ship mentions',
        url: 'https://example.atlassian.net/browse/PROJ-12',
      },
    ]);
    component.rows.set([
      { questionId: 'today', text: '#sh', optionId: '', otherText: '' },
    ]);
    const textarea = document.createElement('textarea');
    textarea.value = '#sh';
    textarea.selectionStart = 3;
    component.onAnswerInput('today', { target: textarea } as unknown as Event);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(component.mentionChoices()[0]?.label).toBe('PROJ-12');
    component.chooseMention('today', 0);
    expect(component.rows()[0]?.text).toBe('#PROJ-12 ');
  });
});

@Component({
  selector: 'vs-home-stub',
  template: 'home',
  standalone: true,
})
class HomeStub {}

describe('MyStandup enter', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app', component: MyStandup },
          { path: 'app/workspace', component: HomeStub },
          { path: 'app/team', component: HomeStub },
        ]),
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
                  my: {
                    title: 'My standup',
                    lead: 'Share updates',
                    noTeams: 'No teams',
                    team: 'Team',
                    yesterday: 'Yesterday',
                    today: 'Today',
                    blockers: 'Blockers',
                    saveDraft: 'Save draft',
                    submit: 'Submit',
                    submitted: 'Submitted',
                    summary: 'Summary',
                  },
                },
                shell: { theme: { toDark: 'Dark', toLight: 'Light' } },
                common: { language: { label: 'Language', en: 'English' } },
              });
            }
          },
        }),
      ],
    }).compileComponents();
  });

  it('sends a workspace admin to workspace admin when enter=1', async () => {
    const harness = await RouterTestingHarness.create(
      '/app?enter=1&workspaceId=ws2',
    );
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws1',
        name: 'Acme',
        slug: 'acme',
        role: 'MEMBER',
        tools: [],
      },
      {
        id: 'ws2',
        name: 'Other',
        slug: 'other',
        role: 'OWNER',
        tools: [{ toolKey: 'vibestandup', enabled: true }],
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const teams = http.match((req) => req.url.includes('/teams/mine'));
    expect(teams.map((req) => req.request.url)).toEqual([
      '/api/workspaces/ws2/teams/mine',
    ]);
    teams[0]?.flush([{ id: 't1', name: 'Team', slug: 'team', role: 'MEMBER' }]);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/app/workspace');
    expect(TestBed.inject(Router).url).toContain('workspaceId=ws2');
    http.verify();
  });
});
