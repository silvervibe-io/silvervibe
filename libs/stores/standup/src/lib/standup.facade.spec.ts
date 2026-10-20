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
import { StandupFacade } from './standup.facade';

describe('StandupFacade', () => {
  let facade: StandupFacade;
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
        StandupFacade,
      ],
    });
    facade = TestBed.inject(StandupFacade);
    preview = TestBed.inject(PreviewContextStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  });

  it('loads teams for a workspace', async () => {
    const load = facade.loadMyTeams('ws1');
    const req = http.expectOne('/api/workspaces/ws1/teams/mine');
    req.flush([{ id: 't1', name: 'Core', slug: 'core', role: 'MEMBER' }]);
    await load;
    expect(facade.teams()).toHaveLength(1);
    expect(facade.selectedTeamId()).toBe('t1');
    expect(facade.isTeamAdmin()).toBe(false);
  });

  it('uses preview team admin when preview is active', async () => {
    userEmail.set('founder@silvervibe.io');
    preview.setWorkspaceRole('OWNER');

    const load = facade.loadMyTeams('ws1');
    const req = http.expectOne('/api/workspaces/ws1/teams/mine');
    req.flush([{ id: 't1', name: 'Core', slug: 'core', role: 'MEMBER' }]);
    await load;

    expect(facade.isTeamAdmin()).toBe(true);
  });
});
