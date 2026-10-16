import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { StandupStore } from './standup.store';

describe('StandupStore', () => {
  let store: StandupStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        StandupStore,
      ],
    });
    store = TestBed.inject(StandupStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
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
});
