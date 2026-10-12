import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  AVAILABLE_LANGS,
  persistLang,
  type SilvervibeLang,
} from '@silvervibe/shared/i18n';

@Component({
  selector: 'sv-lang-switch',
  imports: [TranslocoPipe],
  templateUrl: './lang-switch.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex',
  },
})
export class LangSwitch {
  private readonly transloco = inject(TranslocoService);

  readonly langs = AVAILABLE_LANGS;

  currentLang(): string {
    return this.transloco.getActiveLang();
  }

  onLangChange(event: Event): void {
    const lang = (event.target as HTMLSelectElement).value as SilvervibeLang;
    persistLang(lang);
    this.transloco.setActiveLang(lang);
  }
}
