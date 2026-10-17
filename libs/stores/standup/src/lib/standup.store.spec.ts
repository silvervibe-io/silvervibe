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
import { StandupStore } from './standup.store';

describe('StandupStore', () => {
  let store: StandupStore;
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
        StandupStore,
      ],
    });
    store = TestBed.inject(StandupStore);
    preview = TestBed.inject(PreviewContextStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  });

  it('loads teams for a workspace', async () => {
    const load = store.loadMyTeams('ws1');
    const req = http.expectOne('/api/workspaces/ws1/teams/mine');
    req.flush([{ id: 't1', name: 'Core', slug: 'core', role: 'MEMBER' }]);
    await load;
    expect(store.teams()).toHaveLength(1);
    expect(store.selectedTeamId()).toBe('t1');
    expect(store.isTeamAdmin()).toBe(false);
  });

  it('uses preview team admin when preview is active', async () => {
    userEmail.set('founder@silvervibe.io');
    preview.setWorkspaceRole('OWNER');

    const load = store.loadMyTeams('ws1');
    const req = http.expectOne('/api/workspaces/ws1/teams/mine');
    req.flush([{ id: 't1', name: 'Core', slug: 'core', role: 'MEMBER' }]);
    await load;

    expect(store.isTeamAdmin()).toBe(true);
  });
});
