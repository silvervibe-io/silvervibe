import { computed, inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  defaultPortalAppOrigin,
  PORTAL_APP_ORIGIN,
} from '@silvervibe/shared/auth';
import { toTranslocoReadySignal } from '@silvervibe/shared/i18n';
import { retroShellLinks } from '@silvervibe/stores/retro';

@Injectable({ providedIn: 'root' })
export class RetroShellLinks {
  private readonly transloco = inject(TranslocoService);
  private readonly portalOrigin =
    inject(PORTAL_APP_ORIGIN, { optional: true }) ?? defaultPortalAppOrigin();
  private readonly i18nReady = toTranslocoReadySignal(this.transloco);

  readonly links = computed(() => {
    this.i18nReady();
    return retroShellLinks(
      (key) => this.transloco.translate(key),
      `${this.portalOrigin}/portal`,
    );
  });
}
