import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * Label description + under-control help for neuroinclusive forms.
 * Wire `describedBy` onto the control's `aria-describedby`.
 */
@Component({
  selector: 'sv-field-help',
  imports: [],
  templateUrl: './field-help.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class FieldHelp {
  /** Short purpose under the field label (before the control). */
  readonly description = input<string | null>(null);
  /** Format/example help under the control. */
  readonly help = input<string | null>(null);
  /** Stable id prefix for aria-describedby. */
  readonly controlId = input('field');

  readonly descriptionId = computed(() => `${this.controlId()}-desc`);
  readonly helpId = computed(() => `${this.controlId()}-help`);

  /** Space-separated ids for the associated control. */
  readonly describedBy = computed(() => {
    const ids: string[] = [];
    if (this.description()) {
      ids.push(this.descriptionId());
    }
    if (this.help()) {
      ids.push(this.helpId());
    }
    return ids.join(' ') || null;
  });
}
