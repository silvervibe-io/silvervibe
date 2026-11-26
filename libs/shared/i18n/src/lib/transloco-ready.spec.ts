import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { translocoReady$ } from './transloco-ready';

describe('translocoReady$', () => {
  it('emits after translationLoadSuccess even without a lang change', () => {
    const langChanges$ = new Subject<string>();
    const events$ = new Subject<{ type: string }>();
    const values: number[] = [];

    const sub = translocoReady$({ langChanges$, events$ }).subscribe((v) =>
      values.push(v),
    );

    expect(values).toEqual([0]);
    events$.next({ type: 'translationLoadSuccess' });
    expect(values).toEqual([0, 1]);
    langChanges$.next('nl');
    expect(values).toEqual([0, 1, 2]);
    events$.next({ type: 'other' });
    expect(values).toEqual([0, 1, 2]);

    sub.unsubscribe();
  });
});
