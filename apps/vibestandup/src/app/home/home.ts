import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Shell, ShellLink } from '@silvervibe/shared/ui';
import * as AppActions from '../+state/app.actions';
import { saveDraft } from '../standup/standup.actions';
import { standupFeature } from '../standup/standup.reducer';

@Component({
  selector: 'vs-home',
  imports: [Shell],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Home implements OnInit {
  private readonly store = inject(Store);
  readonly yesterday = signal('');
  readonly today = signal('');
  readonly blockers = signal('');
  readonly saved = this.store.selectSignal(standupFeature.selectStandupState);
  readonly links: ShellLink[] = [
    { label: 'Silvervibe', href: 'http://localhost:4200', external: true },
  ];

  ngOnInit(): void {
    this.store.dispatch(AppActions.initApp());
  }

  onYesterday(event: Event): void {
    this.yesterday.set((event.target as HTMLTextAreaElement).value);
  }

  onToday(event: Event): void {
    this.today.set((event.target as HTMLTextAreaElement).value);
  }

  onBlockers(event: Event): void {
    this.blockers.set((event.target as HTMLTextAreaElement).value);
  }

  save(): void {
    this.store.dispatch(
      saveDraft({
        yesterday: this.yesterday(),
        today: this.today(),
        blockers: this.blockers(),
      }),
    );
  }
}
