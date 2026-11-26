import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { entorno } from './core/config/entorno';
import { AuthDemoService } from './core/demo/auth-demo.service';
import { ComprobantesDemoService } from './core/demo/comprobantes-demo.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { ComprobantesService } from './core/services/comprobantes.service';

registerLocaleData(localeEs, 'es');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'es' },
    // Modo demo (npm run start:demo): servicios simulados en lugar de llamar a Cognito y a la API
    ...(entorno.modoDemo
      ? [
          { provide: AuthService, useClass: AuthDemoService },
          { provide: ComprobantesService, useClass: ComprobantesDemoService },
        ]
      : []),
  ],
};
