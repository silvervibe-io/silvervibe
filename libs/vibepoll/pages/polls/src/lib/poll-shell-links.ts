import { computed, inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  defaultPortalAppOrigin,
  PORTAL_APP_ORIGIN,
} from '@silvervibe/shared/auth';
import { toTranslocoReadySignal } from '@silvervibe/shared/i18n';
import { pollShellLinks } from '@silvervibe/stores/poll';

/**
 * Optional page-level nav. Prefer app `SHELL_LINKS` (no `[links]` on
 * `sv-shell`) so links refresh after catalog load without NG0600.
 */
@Injectable({ providedIn: 'root' })
export class PollShellLinks {
  private readonly transloco = inject(TranslocoService);
  private readonly portalOrigin =
    inject(PORTAL_APP_ORIGIN, { optional: true }) ?? defaultPortalAppOrigin();
  private readonly i18nReady = toTranslocoReadySignal(this.transloco);

  readonly links = computed(() => {
    this.i18nReady();
    return pollShellLinks(
      (key) => this.transloco.translate(key),
      `${this.portalOrigin}/portal`,
    );
  });
}
