import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import {
  PREVIEW_STORAGE_KEY,
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
  PreviewContextStore,
} from '@silvervibe/stores/preview';
import { WorkspaceStore } from './workspace.store';

describe('WorkspaceStore', () => {
  let store: WorkspaceStore;
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
        {
          provide: PREVIEW_SWITCHER_EMAILS,
          useValue: ['founder@silvervibe.io'],
        },
        { provide: PREVIEW_SWITCHER_USER_EMAIL, useValue: userEmail },
        PreviewContextStore,
        WorkspaceStore,
      ],
    });
    store = TestBed.inject(WorkspaceStore);
    preview = TestBed.inject(PreviewContextStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  });

  it('loads memberships and selects the first workspace', async () => {
    const load = store.loadMyWorkspaces();
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
    expect(store.memberships().length).toBe(1);
    expect(store.selectedWorkspaceId()).toBe('ws1');
    expect(store.isWorkspaceAdmin()).toBe(true);
    expect(store.enabledTools()).toEqual([
      { toolKey: 'vibestandup', enabled: true },
    ]);
  });

  it('prefers silvervibe slug and preview role when preview is active', async () => {
    userEmail.set('founder@silvervibe.io');
    preview.setWorkspaceRole('MEMBER');

    const load = store.loadMyWorkspaces();
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

    expect(store.selectedWorkspaceId()).toBe('ws2');
    expect(store.effectiveWorkspaceRole()).toBe('MEMBER');
    expect(store.isWorkspaceAdmin()).toBe(false);
  });
});
