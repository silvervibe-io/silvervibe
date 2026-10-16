import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangSwitch, ThemeToggle } from '@silvervibe/shared/ui';
import { ThemeStore } from '@silvervibe/stores/theme';

@Component({
  selector: 'vs-home',
  imports: [
    LangSwitch,
    NgOptimizedImage,
    RouterLink,
    ThemeToggle,
    TranslocoPipe,
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
    this.theme.mode() === 'dark' ? 'brand/mark-dark.svg' : 'brand/mark.svg',
  );
  readonly isDark = computed(() => this.theme.mode() === 'dark');
}
