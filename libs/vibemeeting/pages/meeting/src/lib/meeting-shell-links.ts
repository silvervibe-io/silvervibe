import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { meetingShellLinks } from '@silvervibe/stores/meeting';

@Injectable({ providedIn: 'root' })
export class MeetingShellLinks {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly links = computed(() => {
    this.lang();
    return meetingShellLinks((key) => this.transloco.translate(key));
  });
}
