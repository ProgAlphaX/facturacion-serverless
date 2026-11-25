import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'fn-topbar',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <span class="entorno">Entorno de desarrollo · API de AWS (us-east-1)</span>
    <span class="usuario">
      <mat-icon fontSet="material-symbols-rounded">account_circle</mat-icon>
      {{ auth.usuario() }}
    </span>
    <button mat-stroked-button type="button" (click)="auth.cerrarSesion()">
      <mat-icon fontSet="material-symbols-rounded">logout</mat-icon>
      Salir
    </button>
  `,
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  protected readonly auth = inject(AuthService);
}
