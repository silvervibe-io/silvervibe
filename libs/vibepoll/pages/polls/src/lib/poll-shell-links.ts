import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { pollShellLinks } from '@silvervibe/stores/poll';

@Injectable({ providedIn: 'root' })
export class PollShellLinks {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly links = computed(() => {
    this.lang();
    return pollShellLinks((key) => this.transloco.translate(key));
  });
}
