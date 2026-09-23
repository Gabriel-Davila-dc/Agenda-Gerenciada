import { HttpErrorResponse } from '@angular/common/http';

/**
 * A frase que vai para a tela quando um pedido à API falha.
 *
 * Nunca repassa o texto do servidor às cegas: um erro interno já chegou à tela
 * de criar conta com o SQL inteiro. Cada tela diz o que cada status significa
 * para ela (porStatus); o que ela não previu cai nas frases gerais abaixo, e
 * a mensagem do servidor só entra num 4xx da própria API, que é sempre uma
 * frase em português pensada para a tela.
 */
export function mensagemDeErro(
  erro: unknown,
  porStatus: Partial<Record<number, string>> = {},
  padrao = 'Não deu certo. Tente de novo.',
): string {
  if (!(erro instanceof HttpErrorResponse)) {
    return padrao;
  }

  if (porStatus[erro.status]) {
    return porStatus[erro.status]!;
  }

  // sem resposta nenhuma: sem internet, API fora do ar ou barrada pelo CORS
  if (erro.status === 0) {
    return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  }
  if (erro.status === 429) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  }
  if (erro.status >= 500) {
    return 'O servidor teve um problema. Tente de novo em instantes.';
  }

  const doServidor = (erro.error as { message?: unknown } | null)?.message;
  return typeof doServidor === 'string' && doServidor.trim() ? doServidor : padrao;
}
