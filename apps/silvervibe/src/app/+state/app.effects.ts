import { Injectable, inject } from '@angular/core';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { switchMap, catchError, of } from 'rxjs';
import * as AppActions from './app.actions';
import * as AppFeature from './app.reducer';

@Injectable()
export class AppEffects {
  private actions$ = inject(Actions);

  init$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.initApp),
      switchMap(() => of(AppActions.loadAppSuccess({ app: [] }))),
      catchError((error) => {
        console.error('Error', error);
        return of(AppActions.loadAppFailure({ error }));
      }),
    ),
  );
}
