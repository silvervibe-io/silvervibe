import { Injectable } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { catalogForLang } from './catalogs';

@Injectable({ providedIn: 'root' })
export class SilvervibeTranslocoLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    return of(catalogForLang(lang));
  }
}
