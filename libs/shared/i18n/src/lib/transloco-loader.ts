import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { I18N_SCOPES } from './langs';

@Injectable({ providedIn: 'root' })
export class SilvervibeTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<Translation> {
    return forkJoin(
      I18N_SCOPES.map((scope) =>
        this.http.get<Translation>(`/i18n/${lang}/${scope}.json`).pipe(
          map((data) => [scope, data] as const),
          catchError(() => of([scope, {}] as const)),
        ),
      ),
    ).pipe(map((entries) => Object.fromEntries(entries)));
  }
}
