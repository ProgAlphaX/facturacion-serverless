import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

import { entorno } from '../../core/config/entorno';
import { AuthService } from '../../core/services/auth.service';
import { mensajeDeError } from '../../core/services/errores-cognito';

const obligatorio = (control: AbstractControl): ValidationErrors | null => Validators.required(control);

@Component({
  selector: 'fn-login-page',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Ruta a la que volver tras entrar (parámetro `volver` del guard). */
  readonly volver = input<string>('/inicio');

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    usuario: ['', [obligatorio]],
    contrasena: ['', [obligatorio]],
  });
  protected readonly modoDemo = entorno.modoDemo;
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly verContrasena = signal(false);

  protected entrar(): void {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    const { usuario, contrasena } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.auth.iniciarSesion(usuario.trim(), contrasena).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.volver());
      },
      error: (error: unknown) => {
        this.error.set(mensajeDeError(error));
        this.enviando.set(false);
      },
    });
  }

  protected alternarContrasena(): void {
    this.verContrasena.update((visible) => !visible);
  }
}
