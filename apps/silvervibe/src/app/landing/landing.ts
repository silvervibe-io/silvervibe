import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '@silvervibe/shared/ui';

@Component({
  selector: 'sv-landing',
  imports: [NgOptimizedImage, RouterLink],
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Landing {
  private readonly theme = inject(ThemeService);

  readonly markSrc = computed(() =>
    this.theme.mode() === 'dark' ? 'brand/mark-dark.svg' : 'brand/mark.svg',
  );

  readonly isDark = computed(() => this.theme.mode() === 'dark');
}
