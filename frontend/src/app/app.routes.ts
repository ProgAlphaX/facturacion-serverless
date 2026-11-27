import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';

// Cada pantalla (y el propio armazón con menú) se descarga solo cuando se visita.
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        data: { titulo: 'Inicio' },
        loadComponent: () => import('./features/inicio/inicio-page').then((m) => m.InicioPage),
      },
      {
        path: 'facturar',
        data: { titulo: 'Facturar' },
        loadComponent: () => import('./features/facturar/facturar-page').then((m) => m.FacturarPage),
      },
      {
        path: 'comprobantes',
        data: { titulo: 'Comprobantes' },
        loadComponent: () => import('./features/comprobantes/comprobantes-page').then((m) => m.ComprobantesPage),
      },
      {
        path: 'comprobantes/:id',
        data: { titulo: 'Detalle', volver: '/comprobantes' },
        loadComponent: () => import('./features/comprobantes/detalle-page').then((m) => m.DetallePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
