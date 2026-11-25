import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { feedbackShellLinks } from '@silvervibe/stores/feedback';

@Injectable({ providedIn: 'root' })
export class FeedbackShellLinks {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly links = computed(() => {
    this.lang();
    return feedbackShellLinks((key) => this.transloco.translate(key));
  });
}
