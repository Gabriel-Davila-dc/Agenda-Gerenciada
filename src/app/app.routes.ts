import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';

/**
 * Cada tela é carregada só quando alguém entra nela.
 *
 * O import dinâmico é o que faz o Angular separar cada tela em um arquivo
 * próprio — inclusive o drag-and-drop do CDK, que só o quadro da agenda usa.
 * Trocar por import de cima volta a juntar tudo no bundle inicial.
 */
export const routes: Routes = [
  // abrir o app é abrir a agenda: é a tela de todo dia
  { path: '', pathMatch: 'full', redirectTo: 'agenda' },
  {
    path: 'agenda',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/agenda/agenda').then((m) => m.Agenda),
  },
  {
    path: 'cadastros',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/cadastros/cadastros').then((m) => m.Cadastros),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register-page/register-page').then((m) => m.RegisterPage),
  },
  { path: '**', redirectTo: 'agenda' },
];
