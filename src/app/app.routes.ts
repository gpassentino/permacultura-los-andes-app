import { Routes } from '@angular/router';
import { authGuard } from './features/auth/auth.guard';
import { accountingGuard } from './features/auth/accounting.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'tablero',
    loadComponent: () => import('./features/tablero/tablero.component').then(m => m.TableroComponent),
    canActivate: [authGuard]
  },
  {
    path: 'academia',
    loadComponent: () => import('./features/academia/academia.component').then(m => m.AcademiaComponent),
    canActivate: [authGuard]
  },
  {
    path: 'academia/:id',
    loadComponent: () => import('./features/academia/taller-detalle/taller-detalle.component').then(m => m.TallerDetalleComponent),
    canActivate: [authGuard]
  },
  {
    path: 'contactos',
    loadComponent: () => import('./features/contactos/contactos.component').then(m => m.ContactosComponent),
    canActivate: [authGuard]
  },
  {
    path: 'contactos/:id',
    loadComponent: () => import('./features/contactos/contacto-detalle/contacto-detalle.component').then(m => m.ContactoDetalleComponent),
    canActivate: [authGuard]
  },
  {
    path: 'servicios',
    loadComponent: () => import('./features/servicios/servicios.component').then(m => m.ServiciosComponent),
    canActivate: [authGuard]
  },
  {
    path: 'calendario',
    loadComponent: () => import('./features/calendario/calendario.component').then(m => m.CalendarioComponent),
    canActivate: [authGuard]
  },
  {
    path: 'contabilidad',
    loadComponent: () => import('./features/contabilidad/contabilidad.component').then(m => m.ContabilidadComponent),
    canActivate: [authGuard, accountingGuard]
  },
  { path: '', redirectTo: '/tablero', pathMatch: 'full' },
  { path: '**', redirectTo: '/tablero' }
];
