import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../theme/theme.service';

export interface ShellLink {
  label: string;
  href: string;
  external?: boolean;
}

@Component({
  selector: 'sv-shell',
  imports: [RouterLink],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen bg-base-100 text-base-content',
  },
})
export class Shell {
  private readonly theme = inject(ThemeService);

  readonly title = input('Silvervibe');
  readonly links = input<ShellLink[]>([]);
  /** Show light/dark toggle in the navbar (default true). */
  readonly showThemeToggle = input(true);

  readonly mode = this.theme.mode;

  toggleTheme(): void {
    this.theme.toggle();
  }
}
