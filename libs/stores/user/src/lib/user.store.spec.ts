import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { UserStore } from './user.store';

describe('UserStore', () => {
  let store: UserStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        UserStore,
      ],
    });
    store = TestBed.inject(UserStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the Neon profile from GET /me', async () => {
    const load = store.loadMe();
    const req = http.expectOne('/api/me');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'cuid1',
      firebaseUid: 'fb1',
      email: 'u@example.com',
      displayName: 'User',
    });
    await load;

    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.profile()).toEqual({
      id: 'cuid1',
      firebaseUid: 'fb1',
      email: 'u@example.com',
      displayName: 'User',
    });
  });

  it('clears profile state', async () => {
    const load = store.loadMe();
    http.expectOne('/api/me').flush({
      id: 'cuid1',
      firebaseUid: 'fb1',
      email: null,
      displayName: null,
    });
    await load;

    store.clear();
    expect(store.profile()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('records an error when /me fails', async () => {
    const load = store.loadMe();
    http
      .expectOne('/api/me')
      .flush(
        { message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await load;

    expect(store.profile()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeTruthy();
  });
});
