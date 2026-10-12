import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Store } from '@ngrx/store';
import { Shell, ShellLink } from '@silvervibe/shared/ui';
import * as AppActions from '../+state/app.actions';
import { saveDraft } from '../standup/standup.actions';
import { standupFeature } from '../standup/standup.reducer';

type StandupDraft = {
  yesterday: string;
  today: string;
  blockers: string;
};

@Component({
  selector: 'vs-home',
  imports: [FormField, Shell, TranslocoPipe],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Home implements OnInit {
  private readonly store = inject(Store);
  private readonly transloco = inject(TranslocoService);

  readonly draftModel = signal<StandupDraft>({
    yesterday: '',
    today: '',
    blockers: '',
  });
  readonly draftForm = form(this.draftModel);

  readonly saved = this.store.selectSignal(standupFeature.selectStandupState);
  private readonly platformLabel = toSignal(
    this.transloco.selectTranslate('standup.links.platform'),
    { initialValue: 'SilverVibe' },
  );
  readonly links = computed<ShellLink[]>(() => [
    {
      label: this.platformLabel(),
      href: 'http://localhost:4200',
      external: true,
    },
  ]);

  ngOnInit(): void {
    this.store.dispatch(AppActions.initApp());
  }

  save(event: Event): void {
    event.preventDefault();
    const draft = this.draftModel();
    this.store.dispatch(saveDraft(draft));
  }
}
