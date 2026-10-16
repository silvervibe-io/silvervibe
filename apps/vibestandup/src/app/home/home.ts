import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangSwitch, ThemeService } from '@silvervibe/shared/ui';

@Component({
  selector: 'vs-home',
  imports: [LangSwitch, NgOptimizedImage, RouterLink, TranslocoPipe],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Home {
  private readonly theme = inject(ThemeService);

  readonly markSrc = computed(() =>
    this.theme.mode() === 'dark' ? 'brand/mark-dark.svg' : 'brand/mark.svg',
  );
  readonly isDark = computed(() => this.theme.mode() === 'dark');
}
