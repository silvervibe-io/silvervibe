import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSilvervibeApiClient } from '@silvervibe/shared/api-client';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { UserFacade } from './user.facade';

describe('UserFacade', () => {
  let facade: UserFacade;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        provideSilvervibeApiClient(),
        UserFacade,
      ],
    });
    facade = TestBed.inject(UserFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the Neon profile from GET /me', async () => {
    const load = facade.loadMe();
    const req = http.expectOne('/api/me');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'cuid1',
      firebaseUid: 'fb1',
      email: 'u@example.com',
      displayName: 'User',
    });
    await load;

    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
    expect(facade.profile()).toEqual({
      id: 'cuid1',
      firebaseUid: 'fb1',
      email: 'u@example.com',
      displayName: 'User',
    });
  });

  it('clears profile state', async () => {
    const load = facade.loadMe();
    http.expectOne('/api/me').flush({
      id: 'cuid1',
      firebaseUid: 'fb1',
      email: null,
      displayName: null,
    });
    await load;

    facade.clear();
    expect(facade.profile()).toBeNull();
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('records an error when /me fails', async () => {
    const load = facade.loadMe();
    http
      .expectOne('/api/me')
      .flush(
        { message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await load;

    expect(facade.profile()).toBeNull();
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeTruthy();
  });

  it('creates a custom token for handoff', async () => {
    const pending = facade.createCustomToken();
    const req = http.expectOne('/api/auth/custom-token');
    expect(req.request.method).toBe('POST');
    req.flush({ customToken: 'tok' });
    await expect(pending).resolves.toEqual({ customToken: 'tok' });
  });
});
