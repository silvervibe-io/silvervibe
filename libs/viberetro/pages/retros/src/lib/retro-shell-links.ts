import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { retroShellLinks } from '@silvervibe/stores/retro';

@Injectable({ providedIn: 'root' })
export class RetroShellLinks {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly links = computed(() => {
    this.lang();
    return retroShellLinks((key) => this.transloco.translate(key));
  });
}
