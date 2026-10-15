import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { Store } from '@ngrx/store';
import { LangSwitch, ThemeService } from '@silvervibe/shared/ui';
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
  imports: [FormField, LangSwitch, NgOptimizedImage, TranslocoPipe],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Home implements OnInit {
  private readonly store = inject(Store);
  private readonly theme = inject(ThemeService);

  readonly draftModel = signal<StandupDraft>({
    yesterday: '',
    today: '',
    blockers: '',
  });
  readonly draftForm = form(this.draftModel);

  readonly saved = this.store.selectSignal(standupFeature.selectStandupState);

  readonly markSrc = computed(() =>
    this.theme.mode() === 'dark' ? 'brand/mark-dark.svg' : 'brand/mark.svg',
  );
  readonly isDark = computed(() => this.theme.mode() === 'dark');

  ngOnInit(): void {
    this.store.dispatch(AppActions.initApp());
  }

  save(event: Event): void {
    event.preventDefault();
    const draft = this.draftModel();
    this.store.dispatch(saveDraft(draft));
  }
}
