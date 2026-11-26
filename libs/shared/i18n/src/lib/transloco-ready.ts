import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { filter, map, merge, startWith, type Observable } from 'rxjs';

type TranslocoReadySource = {
  langChanges$: Observable<string>;
  events$: Observable<{ type: string }>;
};

/**
 * Emits when Transloco becomes usable for `translate()`.
 *
 * `langChanges$` alone is not enough: catalog load uses
 * `translationLoadSuccess` with `emitChange: false`, so shell-link
 * computeds that only depend on lang stay stuck on raw keys.
 */
export function translocoReady$(
  source: TranslocoReadySource,
): Observable<number> {
  return merge(
    source.langChanges$,
    source.events$.pipe(
      filter((event) => event.type === 'translationLoadSuccess'),
    ),
  ).pipe(
    map((_, index) => index + 1),
    startWith(0),
  );
}

/** Signal wrapper for product `SHELL_LINKS` factories. */
export function toTranslocoReadySignal(
  transloco = inject(TranslocoService),
): Signal<number> {
  return toSignal(translocoReady$(transloco), { initialValue: 0 });
}
