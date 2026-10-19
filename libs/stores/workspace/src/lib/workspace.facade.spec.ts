import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideSilvervibeApiClient } from '@silvervibe/shared/api-client';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import {
  PREVIEW_STORAGE_KEY,
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
  PreviewContextStore,
} from '@silvervibe/stores/preview';
import { WorkspaceFacade } from './workspace.facade';

describe('WorkspaceFacade', () => {
  let facade: WorkspaceFacade;
  let http: HttpTestingController;
  let preview: PreviewContextStore;
  const userEmail = signal<string | null>(null);

  beforeEach(() => {
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    userEmail.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        provideSilvervibeApiClient(),
        {
          provide: PREVIEW_SWITCHER_EMAILS,
          useValue: ['founder@silvervibe.io'],
        },
        { provide: PREVIEW_SWITCHER_USER_EMAIL, useValue: userEmail },
        PreviewContextStore,
        WorkspaceFacade,
      ],
    });
    facade = TestBed.inject(WorkspaceFacade);
    preview = TestBed.inject(PreviewContextStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  });

  it('loads memberships and selects the first workspace', async () => {
    const load = facade.loadMyWorkspaces();
    const req = http.expectOne('/api/me/workspaces');
    req.flush([
      {
        id: 'ws1',
        name: 'Acme',
        slug: 'acme',
        role: 'OWNER',
        tools: [{ toolKey: 'vibestandup', enabled: true }],
      },
    ]);
    await load;
    expect(facade.memberships().length).toBe(1);
    expect(facade.selectedWorkspaceId()).toBe('ws1');
    expect(facade.isWorkspaceAdmin()).toBe(true);
    expect(facade.enabledTools()).toEqual([
      { toolKey: 'vibestandup', enabled: true },
    ]);
  });

  it('prefers silvervibe slug and preview role when preview is active', async () => {
    userEmail.set('founder@silvervibe.io');
    preview.setWorkspaceRole('MEMBER');

    const load = facade.loadMyWorkspaces();
    const req = http.expectOne('/api/me/workspaces');
    req.flush([
      {
        id: 'ws1',
        name: 'Acme',
        slug: 'acme',
        role: 'OWNER',
        tools: [],
      },
      {
        id: 'ws2',
        name: 'Silvervibe',
        slug: 'silvervibe',
        role: 'OWNER',
        tools: [],
      },
    ]);
    await load;

    expect(facade.selectedWorkspaceId()).toBe('ws2');
    expect(facade.effectiveWorkspaceRole()).toBe('MEMBER');
    expect(facade.isWorkspaceAdmin()).toBe(false);
  });
});
