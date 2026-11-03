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
import { MemberSettings } from './member-settings';

describe('MemberSettings', () => {
  let fixture: ComponentFixture<MemberSettings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberSettings],
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
                    settings: 'Settings',
                    teamAdmin: 'Team',
                    workspace: 'Workspace',
                  },
                  settings: {
                    title: 'Working hours',
                    lead: 'Your schedule',
                    timezone: 'Timezone',
                    days: 'Days',
                    start: 'Start',
                    end: 'End',
                    save: 'Save settings',
                    saved: 'Saved',
                  },
                  week: {
                    mon: 'Mon',
                    tue: 'Tue',
                    wed: 'Wed',
                    thu: 'Thu',
                    fri: 'Fri',
                    sat: 'Sat',
                    sun: 'Sun',
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
    fixture = TestBed.createComponent(MemberSettings);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/me/workspaces').flush([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/me/schedule').flush({
      timezone: 'Europe/Amsterdam',
      workHours: fixture.componentInstance.week(),
    });
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the saved timezone', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Working hours');
    expect(fixture.componentInstance.model().timezone).toBe('Europe/Amsterdam');
  });

  it('saves the weekly schedule', async () => {
    fixture.componentInstance.updateDay('mon', { start: '08:00' });
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne('/api/me/schedule');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.workHours.mon.start).toBe('08:00');
    req.flush(req.request.body);
    await fixture.whenStable();
    expect(fixture.componentInstance.saved()).toBe(true);
  });
});
