import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { WorkspaceStore } from './workspace.store';

describe('WorkspaceStore', () => {
  let store: WorkspaceStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        WorkspaceStore,
      ],
    });
    store = TestBed.inject(WorkspaceStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
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
});
