import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { StandupStore } from '@silvervibe/stores/standup';
import { WorkspaceStore } from '@silvervibe/stores/workspace';
import { of } from 'rxjs';
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
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the my standup title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('My standup');
  });
});
