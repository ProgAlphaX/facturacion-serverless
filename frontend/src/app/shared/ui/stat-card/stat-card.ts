import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type TonoStat = 'TOTAL' | 'ACEPTADO' | 'RECHAZADO' | 'ERROR_ENVIO';

@Component({
  selector: 'fn-stat-card',
  imports: [MatIconModule],
  template: `
    <span class="icono tono--{{ tono() }}">
      <mat-icon fontSet="material-symbols-rounded">{{ icono() }}</mat-icon>
    </span>
    <span class="etiqueta">{{ etiqueta() }}</span>
    <span class="valor">{{ valor() }}</span>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 4px 14px;
      height: 100%;
      padding: 18px;
      border: 1px solid var(--fn-line);
      border-radius: 16px;
      background: var(--fn-surface);
      box-shadow: 0 1px 2px rgba(27, 32, 64, 0.05);
      color: var(--fn-ink);
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    }

    :host:hover {
      border-color: #c9d0ff;
      box-shadow: 0 12px 32px -12px rgba(27, 32, 64, 0.22);
      transform: translateY(-2px);
    }

    .icono {
      grid-row: 1 / 3;
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 14px;
    }

    .etiqueta {
      color: var(--fn-ink-3);
      font-size: 13px;
      font-weight: 700;
      line-height: 1.2;
    }

    .valor {
      font: 800 30px/1 'Nunito', sans-serif;
    }

    .tono--TOTAL { background: #eef0ff; color: #3b4fd8; }
    .tono--ACEPTADO { background: #e4f7ec; color: #1f9d57; }
    .tono--RECHAZADO { background: #fdeceb; color: #e5484d; }
    .tono--ERROR_ENVIO { background: #f5ecff; color: #9b4ddb; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCard {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<number>();
  readonly icono = input.required<string>();
  readonly tono = input.required<TonoStat>();
}
