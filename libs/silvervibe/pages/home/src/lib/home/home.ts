import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangSwitch, ThemeToggle, UI_BRAND } from '@silvervibe/shared/ui';
import { ThemeStore } from '@silvervibe/stores/theme';

@Component({
  selector: 'sv-home',
  imports: [
    NgOptimizedImage,
    RouterLink,
    TranslocoPipe,
    LangSwitch,
    ThemeToggle,
  ],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen bg-base-100 text-base-content',
  },
})
export class Home {
  private readonly theme = inject(ThemeStore);

  readonly markSrc = computed(() =>
    this.theme.mode() === 'dark' ? UI_BRAND.markDark : UI_BRAND.mark,
  );

  readonly isDark = computed(() => this.theme.mode() === 'dark');
}
