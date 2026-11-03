import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTransloco } from '@jsverse/transloco';
import { provideSilvervibeApiClient } from '@silvervibe/shared/api-client';
import { API_BASE_URL, AuthService } from '@silvervibe/shared/auth';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { UserFacade } from '@silvervibe/stores/user';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Portal } from './portal';

describe('Portal', () => {
  let fixture: ComponentFixture<Portal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Portal],
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
        {
          provide: AuthService,
          useValue: { signOut: async () => undefined, user: () => null },
        },
        WorkspaceFacade,
        UserFacade,
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
                nav: {
                  home: 'Home',
                  about: 'About',
                  portal: 'Portal',
                  account: 'Account',
                },
                portal: {
                  title: 'Your portal',
                  lead: 'Enabled tools',
                  loading: 'Loading…',
                  empty: 'No workspaces',
                  workspace: 'Workspace',
                  tools: 'Tools',
                  noTools: 'No tools',
                  openTool: 'Open',
                  adminHint: 'You are an admin',
                  planHint: 'Preview plan {{plan}}',
                  createTitle: 'Create a workspace',
                  addWorkspace: 'Create another workspace',
                  createName: 'Name',
                  createSlug: 'Slug',
                  createSubmit: 'Create',
                  createSuccess: 'Workspace created.',
                },
                shell: {
                  theme: { toDark: 'Dark', toLight: 'Light' },
                  preview: {
                    badge: 'Preview',
                    role: 'Role',
                    plan: 'Plan',
                    limits: '{{plan}}',
                  },
                },
                common: { language: { label: 'Language', en: 'English' } },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Portal);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/me/workspaces')
      .flush([]);
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
  });

  it('renders the portal title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Your portal');
  });

  it('shows the create workspace form when empty', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('form')).toBeTruthy();
    expect(el.textContent).toContain('Create a workspace');
  });
});

describe('Portal enter', () => {
  let assignLocation: ReturnType<typeof vi.spyOn>;

  function providers() {
    return [
      provideRouter([{ path: 'portal', component: Portal }]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: '/api' },
      provideSilvervibeApiClient(),
      { provide: PREVIEW_SWITCHER_EMAILS, useValue: [] },
      {
        provide: PREVIEW_SWITCHER_USER_EMAIL,
        useValue: signal<string | null>(null),
      },
      {
        provide: AuthService,
        useValue: { signOut: async () => undefined, user: () => null },
      },
      WorkspaceFacade,
      UserFacade,
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
              nav: {
                home: 'Home',
                about: 'About',
                portal: 'Portal',
                account: 'Account',
              },
              portal: {
                title: 'Your portal',
                lead: 'Enabled tools',
                loading: 'Loading…',
                empty: 'No workspaces',
                workspace: 'Workspace',
                tools: 'Tools',
                noTools: 'No tools',
                openTool: 'Open',
                adminHint: 'You are an admin',
                planHint: 'Preview plan {{plan}}',
                createTitle: 'Create a workspace',
                addWorkspace: 'Create another workspace',
                createName: 'Name',
                createSlug: 'Slug',
                createSubmit: 'Create',
                createSuccess: 'Workspace created.',
              },
              shell: { theme: { toDark: 'Dark', toLight: 'Light' } },
              common: { language: { label: 'Language', en: 'English' } },
            });
          }
        },
      }),
    ];
  }

  beforeEach(() => {
    assignLocation = vi
      .spyOn(Portal.prototype, 'assignLocation')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands off the only vibestandup workspace when enter=1', async () => {
    await TestBed.configureTestingModule({
      providers: providers(),
    }).compileComponents();
    const pending = RouterTestingHarness.create('/portal?enter=1');
    const http = TestBed.inject(HttpTestingController);
    const harness = await pending;
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws1',
        name: 'Acme',
        slug: 'acme',
        role: 'OWNER',
        tools: [{ toolKey: 'vibestandup', enabled: true }],
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/auth/custom-token').flush({ customToken: 'tok' });
    await harness.fixture.whenStable();
    expect(assignLocation).toHaveBeenCalledWith(
      expect.stringContaining('workspaceId%3Dws1'),
    );
    expect(assignLocation).toHaveBeenCalledWith(
      expect.stringContaining('enter%3D1'),
    );
    http.verify();
  });
});
