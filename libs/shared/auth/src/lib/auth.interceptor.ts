import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

/** Attaches Firebase ID token to `/api` requests when signed in. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api')) {
    return next(req);
  }

  const auth = inject(AuthService);
  return from(auth.idToken()).pipe(
    switchMap((token) => {
      if (!token) {
        return next(req);
      }
      return next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        }),
      );
    }),
  );
};
