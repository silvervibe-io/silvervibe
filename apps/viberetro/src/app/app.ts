import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'vr-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class App {}
