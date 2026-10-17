import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeStore } from '@silvervibe/stores/theme';
import { Icon } from '../icons/icon';

@Component({
  selector: 'sv-theme-toggle',
  imports: [TranslocoPipe, Icon],
  templateUrl: './theme-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex',
  },
})
export class ThemeToggle {
  private readonly themeStore = inject(ThemeStore);

  /** Dark mode shows sun (switch to light); light mode shows moon. */
  readonly isDark = computed(() => this.themeStore.mode() === 'dark');

  onToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.themeStore.setMode(checked ? 'dark' : 'light');
  }
}
