import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  it('allows activation when a user is signed in', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            whenReady: async () => undefined,
            user: () => ({ uid: 'u1' }),
          },
        },
        {
          provide: Router,
          useValue: { createUrlTree: () => null },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(result).toBe(true);
  });

  it('redirects to /auth with returnUrl when signed out', async () => {
    const tree = { path: '/auth' } as unknown as UrlTree;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            whenReady: async () => undefined,
            user: () => null,
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (
              commands: unknown[],
              extras?: { queryParams?: { returnUrl?: string } },
            ) => {
              expect(commands).toEqual(['/auth']);
              expect(extras?.queryParams?.returnUrl).toBe('/invite/tok');
              return tree;
            },
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/invite/tok' } as never),
    );
    expect(result).toBe(tree);
  });
});
