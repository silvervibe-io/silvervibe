import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  InjectionToken,
  input,
  type Signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangSwitch } from '../lang-switch/lang-switch';
import { PreviewSwitcher } from '../preview-switcher/preview-switcher';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

export interface ShellLink {
  label: string;
  href: string;
  external?: boolean;
}

/** App-wide nav used when a page does not pass its own links. */
export const SHELL_LINKS = new InjectionToken<Signal<readonly ShellLink[]>>(
  'SHELL_LINKS',
);

@Component({
  selector: 'sv-shell',
  imports: [RouterLink, LangSwitch, PreviewSwitcher, ThemeToggle],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen bg-base-100 text-base-content',
  },
})
export class Shell {
  private readonly appLinks = inject(SHELL_LINKS, { optional: true });
  readonly title = input('Silvervibe');
  readonly links = input<ShellLink[]>([]);
  readonly navLinks = computed(() => {
    const explicit = this.links();
    return explicit.length > 0 ? explicit : (this.appLinks?.() ?? []);
  });
  /** Show light/dark toggle in the navbar (default true). */
  readonly showThemeToggle = input(true);
  /** Show language switcher (default true). */
  readonly showLangSwitch = input(true);
}
