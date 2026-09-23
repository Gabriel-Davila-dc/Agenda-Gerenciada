import { HttpErrorResponse } from '@angular/common/http';

import { mensagemDeErro } from './erros';

const resposta = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

describe('mensagemDeErro', () => {
  it('o que a tela previu para o status vence', () => {
    const erro = resposta(401, { message: 'E-mail ou senha incorretos' });

    expect(mensagemDeErro(erro, { 401: 'Confira o e-mail e a senha.' })).toBe('Confira o e-mail e a senha.');
  });

  // o caso que motivou tudo: o SQL do erro de banco chegou à tela de criar conta
  it('erro do servidor nunca repassa o texto dele', () => {
    const erro = resposta(500, { message: "select * from `users` - Table 'railway.users' doesn't exist" });

    const frase = mensagemDeErro(erro);

    expect(frase).toBe('O servidor teve um problema. Tente de novo em instantes.');
    expect(frase).not.toContain('select');
  });

  it('sem resposta (sem internet, API fora do ar) diz que é conexão', () => {
    expect(mensagemDeErro(resposta(0))).toContain('Sem conexão com o servidor');
  });

  it('limite de pedidos pede para esperar', () => {
    expect(mensagemDeErro(resposta(429))).toContain('Espere um minuto');
  });

  it('4xx não previsto usa a frase da própria API', () => {
    const erro = resposta(404, { success: false, message: 'Tarefa não encontrada' });

    expect(mensagemDeErro(erro)).toBe('Tarefa não encontrada');
  });

  it('sem frase nenhuma, fica a padrão da tela', () => {
    expect(mensagemDeErro(resposta(400, 'texto solto'), {}, 'Não deu para entrar.')).toBe('Não deu para entrar.');
    expect(mensagemDeErro(new Error('qualquer'), {}, 'Não deu para entrar.')).toBe('Não deu para entrar.');
  });
});
