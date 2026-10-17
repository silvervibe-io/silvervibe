import { NgStyle } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { UI_ICON, type UiIconName } from './icon-paths';

/**
 * Renders a shared monochrome SVG from `/icons/*.svg` via CSS mask so
 * `text-*` / `fill-current` / button colors tint the icon (`bg-current`).
 */
@Component({
  selector: 'sv-icon',
  imports: [NgStyle],
  templateUrl: './icon.html',
  changeDetection: ChangeDetectionStrategy.OnPush,

  host: {
    class: 'inline-flex shrink-0 text-current',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
    '[attr.role]': 'decorative() ? null : "img"',
    '[attr.aria-label]': 'decorative() ? null : alt()',
  },
})
export class Icon {
  /** Icon file key under `libs/shared/ui/assets/icons`. */
  readonly name = input.required<UiIconName>();
  /** Accessible label when the icon is not purely decorative. */
  readonly label = input<string | null>(null);
  /** When true (default), marked aria-hidden. */
  readonly decorative = input(true);

  readonly src = computed(() => UI_ICON[this.name()]);
  readonly alt = computed(() =>
    this.decorative() ? '' : (this.label() ?? this.name()),
  );

  readonly maskStyle = computed(() => {
    const url = `url(${this.src()})`;
    return {
      'mask-image': url,
      '-webkit-mask-image': url,
      'mask-size': 'contain',
      '-webkit-mask-size': 'contain',
      'mask-repeat': 'no-repeat',
      '-webkit-mask-repeat': 'no-repeat',
      'mask-position': 'center',
      '-webkit-mask-position': 'center',
    };
  });
}
