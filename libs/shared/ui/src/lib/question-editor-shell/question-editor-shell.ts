import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Callout } from '../callout/callout';

/**
 * Presentational shell around a list of question cards + actions.
 */
@Component({
  selector: 'sv-question-editor-shell',
  imports: [Callout],
  templateUrl: './question-editor-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block space-y-4',
  },
})
export class QuestionEditorShell {
  readonly title = input.required<string>();
  readonly purpose = input<string | null>(null);
  readonly tip = input<string | null>(null);
  readonly tipTitle = input<string | null>(null);
}
