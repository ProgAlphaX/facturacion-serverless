import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';
import { AppShell } from './layout/app-shell/app-shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        loadComponent: () => import('./features/inicio/inicio-page').then((m) => m.InicioPage),
      },
      {
        path: 'facturar',
        loadComponent: () => import('./features/facturar/facturar-page').then((m) => m.FacturarPage),
      },
      {
        path: 'comprobantes',
        loadComponent: () => import('./features/comprobantes/comprobantes-page').then((m) => m.ComprobantesPage),
      },
      {
        path: 'comprobantes/:id',
        loadComponent: () => import('./features/comprobantes/detalle-page').then((m) => m.DetallePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
