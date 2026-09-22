import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../services/user-service';

/**
 * Bloqueia a agenda para quem não entrou.
 *
 * Só o 401 manda para o login. Sem internet a agenda abre com o cache: o app
 * é offline-first, e expulsar o usuário justo quando não há rede deixaria
 * inacessível tudo o que ele já tem guardado no aparelho.
 */
export const authGuard: CanActivateFn = async () => {
  const userService = inject(UserService);
  const router = inject(Router);

  const token = localStorage.getItem('token');
  if (!token) {
    return router.parseUrl('/login');
  }

  const estado = await userService.estadoDoToken();
  return estado === 'invalido' ? router.parseUrl('/login') : true;
};
