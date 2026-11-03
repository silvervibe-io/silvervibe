import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { provideSilvervibeApiClient } from '@silvervibe/shared/api-client';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from '@silvervibe/stores/preview';
import { StandupFacade } from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { standupAreaGuard } from './standup-access.guard';

describe('standupAreaGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
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
        WorkspaceFacade,
        StandupFacade,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match(() => true).forEach((req) => req.flush([]));
    http.verify();
    TestBed.resetTestingModule();
  });

  function run(area: 'team' | 'workspace') {
    const route = {
      data: { standupArea: area },
      queryParamMap: convertToParamMap({}),
    } as unknown as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() =>
      standupAreaGuard(route, {} as RouterStateSnapshot),
    );
  }

  it('redirects a member away from workspace admin', async () => {
    const pending = run('workspace');
    http.expectOne('/api/me/workspaces').flush([
      {
        id: 'ws1',
        name: 'Acme',
        slug: 'acme',
        role: 'MEMBER',
        tools: [{ toolKey: 'vibestandup', enabled: true }],
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    http
      .expectOne('/api/workspaces/ws1/teams/mine')
      .flush([{ id: 't1', name: 'Team', slug: 'team', role: 'MEMBER' }]);
    const result = await pending;
    if (!(result instanceof UrlTree)) {
      throw new Error('expected a redirect');
    }
    expect(TestBed.inject(Router).serializeUrl(result)).toBe(
      '/app?workspaceId=ws1',
    );
  });

  it('allows a workspace admin into workspace admin', async () => {
    const pending = run('workspace');
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
    http.expectOne('/api/workspaces/ws1/teams/mine').flush([]);
    await expect(pending).resolves.toBe(true);
  });
});
