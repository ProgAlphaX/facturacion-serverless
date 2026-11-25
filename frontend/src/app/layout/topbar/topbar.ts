import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'fn-topbar',
  template: `
    <span class="entorno">Entorno de desarrollo · API de AWS (us-east-1)</span>
  `,
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {}
