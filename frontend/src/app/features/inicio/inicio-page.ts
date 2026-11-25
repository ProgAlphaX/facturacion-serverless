import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ESTADOS_COMPROBANTE } from '../../core/models/comprobante';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';

@Component({
  selector: 'fn-inicio-page',
  imports: [StatusPill],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage {
  protected readonly estados = ESTADOS_COMPROBANTE;
}
