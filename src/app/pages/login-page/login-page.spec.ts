import { ActivatedRoute, provideRouter } from '@angular/router';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { LoginPage } from './login-page';
import { UserService } from '../../services/user-service';
import { RegisterResponse } from '../../Types/auth';

describe('LoginPage', () => {
  let usuarios: jasmine.SpyObj<UserService>;

  // o que o HttpClient entrega quando a API responde erro
  const falha = (status: number, message: string) =>
    throwError(() => new HttpErrorResponse({ status, error: { message } }));

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
    pagina.confirmacao = 'segredo123';
    return pagina;
  }

  it('em /login só entra', () => {
    const pagina = abrir();
    usuarios.getUserLogin.and.returnValue(falha(401, 'E-mail ou senha incorretos'));

    pagina.enviar();

    expect(pagina.criando).toBeFalse();
    expect(usuarios.postUserRegister).not.toHaveBeenCalled();
    expect(pagina.error).toBe('E-mail ou senha incorretos.');
  });

  it('em /register cria a conta e já entra com ela', () => {
    const pagina = abrir('criar');
    const criada: RegisterResponse = { id: 1, email: 'eu@exemplo.com', createdAt: '', updatedAt: '' };
    usuarios.postUserRegister.and.returnValue(of(criada));
    usuarios.getUserLogin.and.returnValue(falha(401, ''));

    pagina.enviar();

    expect(pagina.criando).toBeTrue();
    expect(usuarios.postUserRegister).toHaveBeenCalledWith('eu@exemplo.com', 'segredo123');
    expect(usuarios.getUserLogin).toHaveBeenCalledWith('eu@exemplo.com', 'segredo123');
  });

  it('conta que não pôde ser criada mostra o motivo e não tenta entrar', () => {
    const pagina = abrir('criar');
    usuarios.postUserRegister.and.returnValue(falha(409, 'Já existe uma conta com esse e-mail'));

    pagina.enviar();

    expect(pagina.error).toBe('Já existe uma conta com esse e-mail. Entre com ela.');
    expect(usuarios.getUserLogin).not.toHaveBeenCalled();
  });

  it('o botão diz cada etapa enquanto espera a API, e volta se der erro', () => {
    const pagina = abrir('criar');
    const criacao = new Subject<RegisterResponse>();
    const entrada = new Subject<never>();
    usuarios.postUserRegister.and.returnValue(criacao);
    usuarios.getUserLogin.and.returnValue(entrada);

    pagina.enviar();
    expect(pagina.textoDoBotao).toBe('Criando sua conta…');
    expect(pagina.ocupado).toBeTrue();

    criacao.next({ id: 1, email: 'eu@exemplo.com', createdAt: '', updatedAt: '' });
    expect(pagina.textoDoBotao).toBe('Entrando…');

    entrada.error(new HttpErrorResponse({ status: 0 }));
    expect(pagina.ocupado).toBeFalse();
    expect(pagina.textoDoBotao).toBe('Criar conta');
    expect(pagina.error).toContain('Sem conexão');
  });

  it('segundo clique enquanto o primeiro anda não cria a conta duas vezes', () => {
    const pagina = abrir('criar');
    usuarios.postUserRegister.and.returnValue(new Subject<RegisterResponse>());

    pagina.enviar();
    pagina.enviar();

    expect(usuarios.postUserRegister).toHaveBeenCalledTimes(1);
  });

  it('senhas diferentes não criam a conta', () => {
    const pagina = abrir('criar');
    pagina.confirmacao = 'segredo124';

    pagina.enviar();

    expect(pagina.senhasIguais).toBeFalse();
    expect(pagina.error).toContain('não estão iguais');
    expect(usuarios.postUserRegister).not.toHaveBeenCalled();
  });

  it('confirmação vazia pede para repetir a senha', () => {
    const pagina = abrir('criar');
    pagina.confirmacao = '';

    pagina.enviar();

    expect(pagina.error).toBe('Repita a senha no segundo campo.');
  });

  it('entrar não pede confirmação', () => {
    const pagina = abrir();
    pagina.confirmacao = '';
    usuarios.getUserLogin.and.returnValue(new Subject<never>());

    pagina.enviar();

    expect(usuarios.getUserLogin).toHaveBeenCalled();
  });

  it('o olho mostra e esconde as duas senhas', () => {
    TestBed.resetTestingModule();
    abrir('criar');
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    const tipos = () => [...tela.querySelectorAll<HTMLInputElement>('#senha, #confirmacao')].map((i) => i.type);

    expect(tipos()).toEqual(['password', 'password']);

    tela.querySelector<HTMLButtonElement>('.ver-senha')!.click();
    fixture.detectChanges();

    expect(tipos()).toEqual(['text', 'text']);
  });

  it('senha curta nem chega a ir para a API', () => {
    const pagina = abrir('criar');
    pagina.password = '123';

    pagina.enviar();

    expect(pagina.error).toContain('6 caracteres');
    expect(usuarios.postUserRegister).not.toHaveBeenCalled();
  });
});
