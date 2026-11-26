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
import { Portal, slugifyWorkspaceName } from './portal';

const portalCatalog = {
  title: 'Your workspace',
  lead: 'Open a tool',
  loading: 'Loading…',
  empty: 'No workspaces',
  workspace: 'Workspace',
  tools: 'Your tools',
  manageTools: 'Manage tools',
  noTools: 'No tools',
  openTool: 'Open',
  toolEnabled: 'On',
  toolDisabled: 'Off',
  planHint: 'Preview plan {{plan}}',
  createTitle: 'Create a workspace',
  addWorkspace: 'Create another workspace',
  createName: 'Name',
  createSlug: 'URL slug',
  createSlugAdvanced: 'Edit URL slug',
  createSubmit: 'Create',
  createSuccess: 'Workspace created.',
  tool: {
    vibestandup: {
      title: 'VibeStandup',
      body: 'Async daily standups for your team.',
    },
    vibepoll: { title: 'VibePoll', body: 'Quick polls.' },
    viberetro: { title: 'VibeRetro', body: 'Retrospectives.' },
    vibefeedback: { title: 'VibeFeedback', body: 'Feedback.' },
    vibemeeting: { title: 'VibeMeeting', body: 'Meetings.' },
  },
};

describe('slugifyWorkspaceName', () => {
  it('builds a url-safe slug from the display name', () => {
    expect(slugifyWorkspaceName('Acme Corp!')).toBe('acme-corp');
    expect(slugifyWorkspaceName('  ')).toBe('workspace');
  });
});

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
                portal: portalCatalog,
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
    expect(el.querySelector('h1')?.textContent).toContain('Your workspace');
  });

  it('shows the create workspace form when empty', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('form')).toBeTruthy();
    expect(el.textContent).toContain('Create a workspace');
    expect(el.textContent).toContain('Edit URL slug');
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
              portal: portalCatalog,
              shell: { theme: { toDark: 'Dark', toLight: 'Light' } },
              common: { language: { label: 'Language', en: 'English' } },
            });
          }
        },
      }),
    ];
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    assignLocation = vi
      .spyOn(Portal.prototype, 'assignLocation')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-enters when a single product is enabled without enter=1', async () => {
    await TestBed.configureTestingModule({
      providers: providers(),
    }).compileComponents();
    const pending = RouterTestingHarness.create('/portal');
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
    http.verify();
  });

  it('hands off when enter=1 and standup is the only product', async () => {
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

  it('stays on the portal when multiple products are enabled', async () => {
    await TestBed.configureTestingModule({
      providers: providers(),
    }).compileComponents();
    const pending = RouterTestingHarness.create('/portal');
    const http = TestBed.inject(HttpTestingController);
    const harness = await pending;
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws1',
        name: 'Acme',
        slug: 'acme',
        role: 'OWNER',
        tools: [
          { toolKey: 'vibestandup', enabled: true },
          { toolKey: 'viberetro', enabled: true },
        ],
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(assignLocation).not.toHaveBeenCalled();
    const el = harness.fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('VibeStandup');
    expect(el.textContent).toContain('Manage tools');
    http.verify();
  });

  it('toggles a tool entitlement for workspace admins', async () => {
    await TestBed.configureTestingModule({
      imports: [Portal],
      providers: providers(),
    }).compileComponents();
    const fixture = TestBed.createComponent(Portal);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws1',
        name: 'Acme',
        slug: 'acme',
        role: 'OWNER',
        tools: [
          { toolKey: 'vibestandup', enabled: true },
          { toolKey: 'vibepoll', enabled: false },
          { toolKey: 'viberetro', enabled: true },
        ],
      },
    ]);
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('input.toggle').length).toBeGreaterThan(0);
    expect(el.textContent).toContain('Manage tools');

    const togglePromise = fixture.componentInstance.toggleTool(
      'vibepoll',
      true,
    );
    await Promise.resolve();
    const put = http.expectOne(
      (req) =>
        req.method === 'PUT' &&
        req.url.includes('/api/workspaces/ws1/tools/vibepoll'),
    );
    expect(put.request.body).toEqual({ enabled: true });
    put.flush({ toolKey: 'vibepoll', enabled: true });
    await Promise.resolve();
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws1',
        name: 'Acme',
        slug: 'acme',
        role: 'OWNER',
        tools: [
          { toolKey: 'vibestandup', enabled: true },
          { toolKey: 'vibepoll', enabled: true },
          { toolKey: 'viberetro', enabled: true },
        ],
      },
    ]);
    await togglePromise;
    await fixture.whenStable();
    http.verify();
  });
});
