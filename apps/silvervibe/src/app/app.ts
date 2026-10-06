import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import * as AppActions from './+state/app.actions';

@Component({
  imports: [RouterModule],
  selector: 'sv-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class App implements OnInit {
  private readonly store = inject(Store);

  ngOnInit(): void {
    this.store.dispatch(AppActions.initApp());
  }
}
