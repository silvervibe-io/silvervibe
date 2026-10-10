import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sv-landing',
  imports: [],
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Landing {}
