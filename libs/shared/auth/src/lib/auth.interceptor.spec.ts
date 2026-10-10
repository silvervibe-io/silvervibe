import { TestBed } from '@angular/core/testing';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => authInterceptor(req, next));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            idToken: async () => 'token-123',
          },
        },
      ],
    });
  });

  it('attaches Bearer token to /api requests', async () => {
    const req = new HttpRequest('GET', '/api/me');
    let authHeader: string | null = null;
    await firstValueFrom(
      interceptor(req, (outgoing) => {
        authHeader = outgoing.headers.get('Authorization');
        return of(new HttpResponse({ status: 200 }));
      }),
    );
    expect(authHeader).toBe('Bearer token-123');
  });

  it('skips non-api requests', async () => {
    const req = new HttpRequest('GET', '/assets/logo.svg');
    let hasAuth = true;
    await firstValueFrom(
      interceptor(req, (outgoing) => {
        hasAuth = outgoing.headers.has('Authorization');
        return of(new HttpResponse({ status: 200 }));
      }),
    );
    expect(hasAuth).toBe(false);
  });
});
