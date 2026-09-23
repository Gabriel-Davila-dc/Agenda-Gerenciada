import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { LoginPage } from './login-page';
import { UserService } from '../../services/user-service';
import { RegisterResponse } from '../../Types/auth';

describe('LoginPage', () => {
  let usuarios: jasmine.SpyObj<UserService>;

  // a mesma tela nos dois modos: a rota diz qual
  function abrir(modo?: 'criar'): LoginPage {
    usuarios = jasmine.createSpyObj<UserService>('UserService', ['getUserLogin', 'postUserRegister']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        { provide: UserService, useValue: usuarios },
        { provide: ActivatedRoute, useValue: { snapshot: { data: modo ? { modo } : {} } } },
      ],
      imports: [LoginPage],
    });

    const pagina = TestBed.createComponent(LoginPage).componentInstance;
    pagina.email = 'eu@exemplo.com';
    pagina.password = 'segredo123';
    return pagina;
  }

  it('em /login só entra', () => {
    const pagina = abrir();
    usuarios.getUserLogin.and.returnValue(throwError(() => ({ error: { message: 'Senha inválida' } })));

    pagina.enviar();

    expect(pagina.criando).toBeFalse();
    expect(usuarios.postUserRegister).not.toHaveBeenCalled();
    expect(pagina.error).toBe('Senha inválida');
  });

  it('em /register cria a conta e já entra com ela', () => {
    const pagina = abrir('criar');
    const criada: RegisterResponse = { id: 1, email: 'eu@exemplo.com', createdAt: '', updatedAt: '' };
    usuarios.postUserRegister.and.returnValue(of(criada));
    usuarios.getUserLogin.and.returnValue(throwError(() => ({ error: {} })));

    pagina.enviar();

    expect(pagina.criando).toBeTrue();
    expect(usuarios.postUserRegister).toHaveBeenCalledWith('eu@exemplo.com', 'segredo123');
    expect(usuarios.getUserLogin).toHaveBeenCalledWith('eu@exemplo.com', 'segredo123');
  });

  it('conta que não pôde ser criada mostra o motivo e não tenta entrar', () => {
    const pagina = abrir('criar');
    usuarios.postUserRegister.and.returnValue(throwError(() => ({ error: { message: 'Usuário já existe' } })));

    pagina.enviar();

    expect(pagina.error).toBe('Usuário já existe');
    expect(usuarios.getUserLogin).not.toHaveBeenCalled();
  });

  it('senha curta nem chega a ir para a API', () => {
    const pagina = abrir('criar');
    pagina.password = '123';

    pagina.enviar();

    expect(pagina.error).toContain('6 caracteres');
    expect(usuarios.postUserRegister).not.toHaveBeenCalled();
  });
});
