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

  it('redirects to /auth when signed out', async () => {
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
            createUrlTree: (commands: unknown[]) => {
              expect(commands).toEqual(['/auth']);
              return tree;
            },
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(result).toBe(tree);
  });
});
