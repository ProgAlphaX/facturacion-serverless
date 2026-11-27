import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { ResultadoEmision } from '../../core/models/emision';

@Component({
  selector: 'fn-resultado-emision',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './resultado-emision.html',
  styleUrl: './resultado-emision.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadoEmisionCard {
  readonly resultado = input.required<ResultadoEmision>();
  /** Segundos que faltan para poder volver a intentar tras un 429. */
  readonly espera = input(0);

  readonly otroComprobante = output();
  readonly otroNumero = output();

  protected copiar(texto: string): void {
    void navigator.clipboard.writeText(texto);
  }
}
