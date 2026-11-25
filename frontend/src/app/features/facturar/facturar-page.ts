import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { interval, map, startWith, take } from 'rxjs';

import { ClaveEjemplo, EJEMPLOS, crearEjemplo, numeroAleatorio } from '../../core/ejemplos/ejemplos-comprobante';
import {
  ComprobanteEntrada,
  ETIQUETA_DOCUMENTO,
  ETIQUETA_TIPO,
  ETIQUETA_UNIDAD,
  ItemComprobante,
  Moneda,
  ReglaIncumplida,
  TipoComprobante,
  TipoDocumento,
  UnidadMedida,
} from '../../core/models/comprobante';
import { ResultadoEmision } from '../../core/models/emision';
import { agruparPorCampo, hoyEnLima, validarBorrador } from '../../core/reglas/reglas-comprobante';
import { ComprobantesService } from '../../core/services/comprobantes.service';
import { ValorFormulario, aComprobante } from './borrador';
import { ResultadoEmisionCard } from './resultado-emision';

const SEGUNDOS_DE_ESPERA_TRAS_429 = 5;
const SERIE_POR_TIPO: Readonly<Record<TipoComprobante, string>> = { '01': 'F001', '03': 'B001' };
const DOCUMENTO_POR_TIPO: Readonly<Record<TipoComprobante, TipoDocumento>> = { '01': '6', '03': '1' };

type GrupoItem = FormGroup<{
  descripcion: FormControl<string>;
  unidad: FormControl<UnidadMedida>;
  cantidad: FormControl<number | null>;
  valorUnitario: FormControl<number | null>;
}>;

function crearItem(fb: NonNullableFormBuilder, item?: ItemComprobante): GrupoItem {
  return fb.group({
    descripcion: fb.control(item?.descripcion ?? ''),
    unidad: fb.control<UnidadMedida>(item?.unidad ?? 'ZZ'),
    cantidad: fb.control<number | null>(item?.cantidad ?? 1),
    valorUnitario: fb.control<number | null>(item?.valorUnitario ?? null),
  });
}

@Component({
  selector: 'fn-facturar-page',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    ResultadoEmisionCard,
  ],
  templateUrl: './facturar-page.html',
  styleUrl: './facturar-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacturarPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly comprobantes = inject(ComprobantesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tipos = Object.entries(ETIQUETA_TIPO) as readonly [TipoComprobante, string][];
  protected readonly documentos = Object.entries(ETIQUETA_DOCUMENTO) as readonly [TipoDocumento, string][];
  protected readonly unidades = Object.entries(ETIQUETA_UNIDAD) as readonly [UnidadMedida, string][];
  protected readonly monedas: readonly Moneda[] = ['PEN', 'USD'];
  protected readonly ejemplos = EJEMPLOS;

  protected readonly formulario = this.fb.group({
    tipo: this.fb.control<TipoComprobante>('01'),
    serie: this.fb.control('F001'),
    numero: this.fb.control<number | null>(numeroAleatorio()),
    fechaEmision: this.fb.control(hoyEnLima()),
    moneda: this.fb.control<Moneda>('PEN'),
    cliente: this.fb.group({
      tipoDoc: this.fb.control<TipoDocumento>('6'),
      numDoc: this.fb.control(''),
      nombre: this.fb.control(''),
    }),
    items: this.fb.array<GrupoItem>([crearItem(this.fb)]),
  });

  private readonly valor = toSignal(
    this.formulario.valueChanges.pipe(
      map((): ValorFormulario => this.formulario.getRawValue()),
      startWith<ValorFormulario>(this.formulario.getRawValue()),
    ),
    { requireSync: true },
  );

  /** Lo que se enviaría ahora mismo; los totales salen de los ítems. */
  protected readonly comprobante = computed<ComprobanteEntrada>(() => aComprobante(this.valor()));

  protected readonly enviando = signal(false);
  protected readonly resultado = signal<ResultadoEmision | null>(null);
  protected readonly modoPrueba = signal(false);
  protected readonly espera = signal(0);
  /** Los avisos en vivo solo aparecen cuando la persona ya empezó a escribir. */
  private readonly editado = signal(false);
  private readonly erroresServidor = signal<readonly ReglaIncumplida[]>([]);

  protected readonly avisosVivos = computed(() => validarBorrador(this.comprobante(), hoyEnLima()));
  private readonly avisosPorCampo = computed(() =>
    agruparPorCampo([...(this.editado() ? this.avisosVivos() : []), ...this.erroresServidor()]),
  );
  protected readonly pendientes = computed(() => (this.editado() ? this.avisosVivos().length : 0));
  protected readonly bloqueado = computed(
    () => this.enviando() || this.espera() > 0 || (this.avisosVivos().length > 0 && !this.modoPrueba()),
  );
  protected readonly simbolo = computed(() => (this.comprobante().moneda === 'USD' ? 'US$' : 'S/'));

  constructor() {
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.editado.set(true);
      this.erroresServidor.set([]);
    });
    this.formulario.controls.tipo.valueChanges.pipe(takeUntilDestroyed()).subscribe((tipo) => {
      this.formulario.patchValue({ serie: SERIE_POR_TIPO[tipo], cliente: { tipoDoc: DOCUMENTO_POR_TIPO[tipo] } });
    });
  }

  protected avisos(campo: string): readonly string[] {
    return this.avisosPorCampo().get(campo) ?? [];
  }

  protected get items(): FormArray<GrupoItem> {
    return this.formulario.controls.items;
  }

  protected agregarItem(): void {
    this.items.push(crearItem(this.fb));
  }

  protected quitarItem(indice: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(indice);
    }
  }

  protected cargarEjemplo(clave: ClaveEjemplo): void {
    const ejemplo = crearEjemplo(clave, hoyEnLima(), numeroAleatorio());
    this.items.clear({ emitEvent: false });
    ejemplo.items.forEach((item) => {
      this.items.push(crearItem(this.fb, item), { emitEvent: false });
    });
    this.formulario.patchValue({
      tipo: ejemplo.tipo,
      serie: ejemplo.serie,
      numero: ejemplo.numero,
      fechaEmision: ejemplo.fechaEmision,
      moneda: ejemplo.moneda,
      cliente: ejemplo.cliente,
    });
    this.resultado.set(null);
  }

  protected otroNumero(): void {
    this.formulario.patchValue({ numero: numeroAleatorio() });
    this.resultado.set(null);
  }

  protected emitir(): void {
    if (this.bloqueado()) {
      return;
    }
    this.enviando.set(true);
    this.resultado.set(null);
    this.erroresServidor.set([]);
    this.comprobantes.emitir(this.comprobante()).subscribe((resultado) => {
      this.enviando.set(false);
      this.resultado.set(resultado);
      if (resultado.resultado === 'INVALIDO') {
        this.erroresServidor.set(resultado.errores);
      } else if (resultado.resultado === 'LIMITE_PETICIONES') {
        this.iniciarEspera();
      }
    });
  }

  private iniciarEspera(): void {
    this.espera.set(SEGUNDOS_DE_ESPERA_TRAS_429);
    interval(1000)
      .pipe(take(SEGUNDOS_DE_ESPERA_TRAS_429), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.espera.update((segundos) => segundos - 1);
      });
  }
}
