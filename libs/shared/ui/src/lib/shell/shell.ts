import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangSwitch } from '../lang-switch/lang-switch';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

export interface ShellLink {
  label: string;
  href: string;
  external?: boolean;
}

@Component({
  selector: 'sv-shell',
  imports: [RouterLink, LangSwitch, ThemeToggle],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen bg-base-100 text-base-content',
  },
})
export class Shell {
  readonly title = input('Silvervibe');
  readonly links = input<ShellLink[]>([]);
  /** Show light/dark toggle in the navbar (default true). */
  readonly showThemeToggle = input(true);
  /** Show language switcher (default true). */
  readonly showLangSwitch = input(true);
}
