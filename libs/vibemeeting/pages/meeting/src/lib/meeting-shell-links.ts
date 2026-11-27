import { computed, inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  defaultPortalAppOrigin,
  PORTAL_APP_ORIGIN,
} from '@silvervibe/shared/auth';
import { toTranslocoReadySignal } from '@silvervibe/shared/i18n';
import { meetingShellLinks } from '@silvervibe/stores/meeting';

@Injectable({ providedIn: 'root' })
export class MeetingShellLinks {
  private readonly transloco = inject(TranslocoService);
  private readonly portalOrigin =
    inject(PORTAL_APP_ORIGIN, { optional: true }) ?? defaultPortalAppOrigin();
  private readonly i18nReady = toTranslocoReadySignal(this.transloco);

  readonly links = computed(() => {
    this.i18nReady();
    return meetingShellLinks(
      (key) => this.transloco.translate(key),
      `${this.portalOrigin}/portal`,
    );
  });
}
